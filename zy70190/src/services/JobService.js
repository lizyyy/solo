const { BackgroundJob } = require('../models');
const ResultService = require('./ResultService');

class JobService {
  static async createJob(jobType, shortageId = null, payload = null, maxRetries = 3) {
    try {
      const job = await BackgroundJob.create({
        jobType,
        shortageId,
        payload: payload ? JSON.stringify(payload) : null,
        status: 'pending',
        retryCount: 0,
        maxRetries
      });
      return job;
    } catch (error) {
      console.error('创建后台任务失败:', error);
      throw error;
    }
  }

  static async executeJob(jobId) {
    const job = await BackgroundJob.findByPk(jobId);
    if (!job) {
      throw new Error('任务不存在');
    }

    if (job.status !== 'pending') {
      throw new Error(`任务状态不允许执行：${job.status}`);
    }

    try {
      await job.update({
        status: 'running',
        executedAt: new Date()
      });

      const result = await this._processJob(job);

      await job.update({
        status: 'completed',
        completedAt: new Date()
      });

      return {
        success: true,
        jobId: job.id,
        result
      };
    } catch (error) {
      const newRetryCount = job.retryCount + 1;

      if (newRetryCount >= job.maxRetries) {
        await job.update({
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage: error.message
        });

        return {
          success: false,
          jobId: job.id,
          error: `任务执行失败，已重试${newRetryCount}次，达到最大重试次数。错误信息：${error.message}`,
          canRetry: false
        };
      } else {
        await job.update({
          status: 'pending',
          retryCount: newRetryCount,
          errorMessage: error.message
        });

        return {
          success: false,
          jobId: job.id,
          error: `任务执行失败，第${newRetryCount}次重试。错误信息：${error.message}`,
          canRetry: true,
          nextRetryIn: `下次可手动重试，或等待系统自动重试`
        };
      }
    }
  }

  static async _processJob(job) {
    const payload = job.payload ? JSON.parse(job.payload) : null;

    switch (job.jobType) {
      case 'calculate_result':
        if (!job.shortageId) {
          throw new Error('计算结果任务需要缺料单ID');
        }
        const result = await ResultService.calculateShortageResult(job.shortageId);
        return result;

      case 'recalculate_shortage':
        const recalcResult = await ResultService.recalculateAll();
        return recalcResult;

      case 'generate_report':
        return {
          message: '报告生成功能开发中',
          payload
        };

      default:
        throw new Error(`未知的任务类型：${job.jobType}`);
    }
  }

  static async getJobStatus(jobId) {
    const job = await BackgroundJob.findByPk(jobId);
    if (!job) {
      throw new Error('任务不存在');
    }

    return {
      jobId: job.id,
      jobType: job.jobType,
      status: job.status,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      errorMessage: job.errorMessage,
      executedAt: job.executedAt,
      completedAt: job.completedAt,
      canRetry: job.status === 'pending' && job.retryCount < job.maxRetries
    };
  }

  static async listJobs(filter = {}) {
    try {
      const where = {};
      if (filter.status) where.status = filter.status;
      if (filter.jobType) where.jobType = filter.jobType;

      const jobs = await BackgroundJob.findAll({
        where,
        order: [['createdAt', 'DESC']]
      });

      return jobs.map(job => ({
        jobId: job.id,
        jobType: job.jobType,
        status: job.status,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        createdAt: job.createdAt
      }));
    } catch (error) {
      console.error('查询任务列表失败:', error);
      throw error;
    }
  }

  static async retryJob(jobId) {
    const job = await BackgroundJob.findByPk(jobId);
    if (!job) {
      throw new Error('任务不存在');
    }

    if (job.status !== 'pending') {
      throw new Error('只有待执行状态的任务可以重试');
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error('已达到最大重试次数，无法继续重试');
    }

    return await this.executeJob(jobId);
  }

  static async processPendingJobs() {
    const pendingJobs = await BackgroundJob.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']]
    });

    const results = [];
    for (const job of pendingJobs) {
      const result = await this.executeJob(job.id);
      results.push(result);
    }

    return {
      totalProcessed: results.length,
      results
    };
  }
}

module.exports = JobService;
