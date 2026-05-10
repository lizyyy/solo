const db = require('../db/connection');
const config = require('../config');
const { getStatusAtTime } = require('../utils/statusManager');

async function getStatusStatistics(req, res) {
  try {
    const { start_time, end_time } = req.query;

    const whereConditions = ['is_deleted = 0'];
    const params = [];

    if (start_time) {
      whereConditions.push('created_at >= ?');
      params.push(parseInt(start_time));
    }
    if (end_time) {
      whereConditions.push('created_at <= ?');
      params.push(parseInt(end_time));
    }

    const whereClause = whereConditions.join(' AND ');

    const stats = await db.all(
      `SELECT current_status as status, COUNT(*) as count
       FROM repair_requests 
       WHERE ${whereClause}
       GROUP BY current_status
       ORDER BY count DESC`,
      params
    );

    const statusMap = {
      [config.status.DRAFT]: '草稿',
      [config.status.PENDING_REVIEW]: '待审核',
      [config.status.REVIEW_APPROVED]: '审核通过',
      [config.status.REVIEW_REJECTED]: '审核拒绝',
      [config.status.EXECUTING]: '执行中',
      [config.status.EXECUTION_SUCCESS]: '执行成功',
      [config.status.EXECUTION_FAILED]: '执行失败',
      [config.status.ROLLBACK_REQUESTED]: '待回滚',
      [config.status.ROLLBACK_EXECUTING]: '回滚中',
      [config.status.ROLLBACK_SUCCESS]: '回滚成功',
      [config.status.ROLLBACK_FAILED]: '回滚失败',
      [config.status.CLOSED]: '已关闭',
      [config.status.CANCELLED]: '已取消'
    };

    const result = stats.map(s => ({
      status: s.status,
      status_name: statusMap[s.status] || s.status,
      count: s.count
    }));

    const total = result.reduce((sum, s) => sum + s.count, 0);

    res.json({
      total,
      statistics: result
    });
  } catch (error) {
    console.error('Error getting status statistics:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getHistoricalStatusStatistics(req, res) {
  try {
    const { target_time } = req.query;

    if (!target_time) {
      return res.status(400).json({ error: 'Missing required parameter: target_time' });
    }

    const requests = await db.all(
      'SELECT id FROM repair_requests WHERE created_at <= ? AND is_deleted = 0',
      [parseInt(target_time)]
    );

    const statusCounts = {};

    for (const req of requests) {
      const status = await getStatusAtTime(req.id, parseInt(target_time));
      if (status) {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      }
    }

    const statusMap = {
      [config.status.DRAFT]: '草稿',
      [config.status.PENDING_REVIEW]: '待审核',
      [config.status.REVIEW_APPROVED]: '审核通过',
      [config.status.REVIEW_REJECTED]: '审核拒绝',
      [config.status.EXECUTING]: '执行中',
      [config.status.EXECUTION_SUCCESS]: '执行成功',
      [config.status.EXECUTION_FAILED]: '执行失败',
      [config.status.ROLLBACK_REQUESTED]: '待回滚',
      [config.status.ROLLBACK_EXECUTING]: '回滚中',
      [config.status.ROLLBACK_SUCCESS]: '回滚成功',
      [config.status.ROLLBACK_FAILED]: '回滚失败',
      [config.status.CLOSED]: '已关闭',
      [config.status.CANCELLED]: '已取消'
    };

    const result = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      status_name: statusMap[status] || status,
      count
    }));

    const total = result.reduce((sum, s) => sum + s.count, 0);

    res.json({
      target_time: parseInt(target_time),
      total,
      statistics: result
    });
  } catch (error) {
    console.error('Error getting historical statistics:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getManualCorrections(req, res) {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);

    const [countResult, corrections] = await Promise.all([
      db.get(
        `SELECT COUNT(*) as total FROM status_history 
         WHERE is_manual_correction = 1`,
        []
      ),
      db.all(
        `SELECT sh.*, r.ticket_no, r.title
         FROM status_history sh
         JOIN repair_requests r ON sh.request_id = r.id
         WHERE sh.is_manual_correction = 1
         ORDER BY sh.created_at DESC
         LIMIT ? OFFSET ?`,
        [parseInt(page_size), offset]
      )
    ]);

    res.json({
      total: countResult.total,
      page: parseInt(page),
      page_size: parseInt(page_size),
      data: corrections
    });
  } catch (error) {
    console.error('Error getting manual corrections:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getExecutionStatistics(req, res) {
  try {
    const { start_time, end_time } = req.query;

    const whereConditions = [];
    const params = [];

    if (start_time) {
      whereConditions.push('created_at >= ?');
      params.push(parseInt(start_time));
    }
    if (end_time) {
      whereConditions.push('created_at <= ?');
      params.push(parseInt(end_time));
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    const stats = await db.all(
      `SELECT 
         SUM(CASE WHEN execution_status = 'success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN execution_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
         SUM(affected_rows) as total_affected_rows,
         COUNT(*) as total_executions
       FROM execution_results
       ${whereClause}`,
      params
    );

    const stat = stats[0];
    const successRate = stat.total_executions > 0 
      ? ((stat.success_count / stat.total_executions) * 100).toFixed(2) 
      : '0.00';

    res.json({
      total_executions: stat.total_executions || 0,
      success_count: stat.success_count || 0,
      failed_count: stat.failed_count || 0,
      success_rate: parseFloat(successRate),
      total_affected_rows: stat.total_affected_rows || 0
    });
  } catch (error) {
    console.error('Error getting execution statistics:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getDepartmentStatistics(req, res) {
  try {
    const stats = await db.all(
      `SELECT 
         department,
         COUNT(*) as total_requests,
         SUM(CASE WHEN current_status = 'execution_success' THEN 1 ELSE 0 END) as success_count,
         SUM(CASE WHEN current_status = 'execution_failed' THEN 1 ELSE 0 END) as failed_count
       FROM repair_requests
       WHERE is_deleted = 0
       GROUP BY department
       ORDER BY total_requests DESC`,
      []
    );

    res.json({
      statistics: stats.map(s => ({
        department: s.department || '未指定',
        total_requests: s.total_requests,
        success_count: s.success_count,
        failed_count: s.failed_count,
        success_rate: s.total_requests > 0 
          ? ((s.success_count / s.total_requests) * 100).toFixed(2) 
          : '0.00'
      }))
    });
  } catch (error) {
    console.error('Error getting department statistics:', error);
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getStatusStatistics,
  getHistoricalStatusStatistics,
  getManualCorrections,
  getExecutionStatistics,
  getDepartmentStatistics
};