const pool = require('../database/pool');
const { ApiError } = require('../utils/response');
const ExportService = require('./exportService');
const config = require('../config/config');

class BackgroundJobService {
  static async getPendingJobs() {
    const result = await pool.query(
      `SELECT * FROM background_jobs 
       WHERE status IN ('pending', 'failed')
       ORDER BY priority DESC, created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 10`
    );
    return result.rows;
  }

  static async markJobRunning(jobId) {
    const result = await pool.query(
      `UPDATE background_jobs 
       SET status = 'running', last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [jobId]
    );
    return result.rows[0];
  }

  static async markJobCompleted(jobId) {
    await pool.query(
      `UPDATE background_jobs 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [jobId]
    );
  }

  static async markJobFailed(jobId, errorMessage) {
    const result = await pool.query(
      `UPDATE background_jobs 
       SET status = CASE 
         WHEN retry_count >= max_retries THEN 'failed'
         ELSE 'failed'
       END,
       error_message = $1,
       retry_count = retry_count + 1,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [errorMessage, jobId]
    );
    return result.rows[0];
  }

  static async executeJob(job) {
    const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;

    try {
      switch (job.job_type) {
        case 'export':
          await ExportService.executeExport(payload.export_id);
          break;
        
        default:
          throw new Error(`未知的任务类型: ${job.job_type}`);
      }

      await this.markJobCompleted(job.id);
      return { success: true };
    } catch (error) {
      const updatedJob = await this.markJobFailed(job.id, error.message);
      
      if (updatedJob.retry_count < updatedJob.max_retries) {
        setTimeout(async () => {
          try {
            await this.retryJob(updatedJob.id);
          } catch (e) {
            console.error('自动重试失败:', e);
          }
        }, this.calculateBackoff(updatedJob.retry_count));
      }

      throw error;
    }
  }

  static calculateBackoff(retryCount) {
    const baseDelay = config.queue.backoffDelay;
    if (config.queue.backoffType === 'exponential') {
      return baseDelay * Math.pow(2, retryCount - 1);
    }
    return baseDelay * retryCount;
  }

  static async retryJob(jobId) {
    const result = await pool.query(
      `UPDATE background_jobs 
       SET status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'failed'
       RETURNING *`,
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('任务不存在或状态不允许重试', 400, 'JOB_CANNOT_RETRY');
    }

    return result.rows[0];
  }

  static async retryFailedJobs(jobType = null) {
    const conditions = ["status = 'failed'"];
    const params = [];
    let paramIndex = 1;

    if (jobType) {
      conditions.push(`job_type = $${paramIndex}`);
      params.push(jobType);
      paramIndex++;
    }

    const result = await pool.query(
      `UPDATE background_jobs 
       SET status = 'pending', updated_at = CURRENT_TIMESTAMP
       WHERE ${conditions.join(' AND ')}
       RETURNING id, job_type, job_name`,
      params
    );

    return {
      retried_count: result.rows.length,
      jobs: result.rows
    };
  }

  static async getJobStatus(jobId) {
    const result = await pool.query(
      'SELECT * FROM background_jobs WHERE id = $1',
      [jobId]
    );

    if (result.rows.length === 0) {
      throw new ApiError('任务不存在', 404, 'JOB_NOT_FOUND');
    }

    return result.rows[0];
  }

  static async listJobs(filters = {}, page = 1, pageSize = 20) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (filters.job_type) {
      conditions.push(`job_type = $${paramIndex}`);
      params.push(filters.job_type);
      paramIndex++;
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM background_jobs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const offset = (page - 1) * pageSize;
    const jobsResult = await pool.query(
      `SELECT id, job_type, job_name, status, priority, retry_count, max_retries,
              error_message, last_run_at, completed_at, created_at
       FROM background_jobs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, pageSize, offset]
    );

    return {
      jobs: jobsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  static async getJobStats() {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM background_jobs
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY status
    `);

    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    result.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });

    return stats;
  }
}

module.exports = BackgroundJobService;
