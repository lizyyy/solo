const db = require('../database/connection');
const { Parser } = require('json2csv');
const moment = require('moment');
const { getStatusText, getPriorityText } = require('./taskService');

async function getTasksForExport(filter = {}) {
  const conditions = ['is_deleted = 0'];
  const params = [];
  
  if (filter.status) {
    conditions.push('status = ?');
    params.push(filter.status);
  }
  if (filter.assignee) {
    conditions.push('assignee = ?');
    params.push(filter.assignee);
  }
  if (filter.created_by) {
    conditions.push('created_by = ?');
    params.push(filter.created_by);
  }
  if (filter.problem_type) {
    conditions.push('problem_type = ?');
    params.push(filter.problem_type);
  }
  if (filter.startTime) {
    conditions.push('created_at >= ?');
    params.push(filter.startTime);
  }
  if (filter.endTime) {
    conditions.push('created_at <= ?');
    params.push(filter.endTime);
  }
  
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const sql = `SELECT * FROM tasks ${whereClause} ORDER BY created_at DESC`;
  
  return db.all(sql, params);
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  return moment(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function transformTaskForExport(task) {
  return {
    '任务编号': task.task_no,
    '客户姓名': task.customer_name,
    '联系电话': task.customer_phone || '',
    '客户账号': task.customer_account || '',
    '问题类型': task.problem_type,
    '问题描述': task.description || '',
    '承诺动作': task.promised_action,
    '状态': getStatusText(task.status),
    '优先级': getPriorityText(task.priority),
    '指派人': task.assignee || '',
    '创建人': task.created_by,
    '创建时间': formatDate(task.created_at),
    '更新时间': formatDate(task.updated_at),
    '截止时间': formatDate(task.due_at),
    '完成时间': formatDate(task.completed_at),
    '重试次数': task.retry_count || 0,
    '最后错误': task.last_error || ''
  };
}

async function exportTasksToCSV(filter = {}, operator) {
  const tasks = await getTasksForExport(filter);
  const transformedTasks = tasks.map(transformTaskForExport);
  
  const fields = [
    '任务编号', '客户姓名', '联系电话', '客户账号', '问题类型', '问题描述',
    '承诺动作', '状态', '优先级', '指派人', '创建人', '创建时间',
    '更新时间', '截止时间', '完成时间', '重试次数', '最后错误'
  ];
  
  const parser = new Parser({ fields, encoding: 'utf8' });
  const csv = parser.parse(transformedTasks);
  
  const bom = '\uFEFF';
  return bom + csv;
}

async function getStatisticsReport(startTime = null, endTime = null) {
  const now = Date.now();
  const start = startTime || now - 30 * 24 * 60 * 60 * 1000;
  const end = endTime || now;
  
  const statusStats = await db.all(
    `SELECT status, COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 AND created_at >= ? AND created_at <= ?
     GROUP BY status`,
    [start, end]
  );
  
  const priorityStats = await db.all(
    `SELECT priority, COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 AND created_at >= ? AND created_at <= ?
     GROUP BY priority`,
    [start, end]
  );
  
  const assigneeStats = await db.all(
    `SELECT assignee, status, COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 AND created_at >= ? AND created_at <= ?
     GROUP BY assignee, status`,
    [start, end]
  );
  
  const problemTypeStats = await db.all(
    `SELECT problem_type, COUNT(*) as count 
     FROM tasks 
     WHERE is_deleted = 0 AND created_at >= ? AND created_at <= ?
     GROUP BY problem_type`,
    [start, end]
  );
  
  const dailyStats = await db.all(
    `SELECT 
       DATE(created_at/1000, 'unixepoch', 'localtime') as date,
       COUNT(*) as total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM tasks 
     WHERE is_deleted = 0 AND created_at >= ? AND created_at <= ?
     GROUP BY DATE(created_at/1000, 'unixepoch', 'localtime')
     ORDER BY date`,
    [start, end]
  );
  
  return {
    period: {
      start: formatDate(start),
      end: formatDate(end)
    },
    statusStats: statusStats.map(s => ({ status: getStatusText(s.status), count: s.count })),
    priorityStats: priorityStats.map(p => ({ priority: getPriorityText(p.priority), count: p.count })),
    assigneeStats,
    problemTypeStats,
    dailyStats
  };
}

module.exports = {
  exportTasksToCSV,
  getStatisticsReport,
  getTasksForExport
};
