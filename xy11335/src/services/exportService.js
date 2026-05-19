const db = require('../db');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

const exportDir = path.join(__dirname, '../../exports');
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}

function queryAuditLogs(filters = {}) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.operator) {
    query += ' AND operator = ?';
    params.push(filters.operator);
  }

  if (filters.operator_role) {
    query += ' AND operator_role = ?';
    params.push(filters.operator_role);
  }

  if (filters.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }

  if (filters.error_type) {
    query += ' AND error_type = ?';
    params.push(filters.error_type);
  }

  if (filters.start_time) {
    query += ' AND created_at >= ?';
    params.push(parseInt(filters.start_time));
  }

  if (filters.end_time) {
    query += ' AND created_at <= ?';
    params.push(parseInt(filters.end_time));
  }

  query += ' ORDER BY created_at DESC';

  const logs = db.prepare(query).all(...params);
  return logs;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatStatus(status) {
  const statusMap = {
    'pending': '待接单',
    'accepted': '已接单',
    'in_progress': '进行中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

function formatRole(role) {
  const roleMap = {
    'nurse': '护士',
    'accompanier': '陪检员',
    'admin': '管理员',
    'system': '系统'
  };
  return roleMap[role] || role;
}

function formatAction(action) {
  const actionMap = {
    'create': '创建任务',
    'accept': '接单',
    'start': '开始陪检',
    'complete': '完成陪检',
    'cancel': '取消任务',
    'jump_queue': '插队',
    'mark_overtime': '标记超时'
  };
  return actionMap[action] || action;
}

async function exportTasksToCSV(filters = {}) {
  const query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  let whereClause = '1=1';
  if (filters.status) {
    whereClause += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.assigned_to) {
    whereClause += ' AND assigned_to = ?';
    params.push(filters.assigned_to);
  }
  if (filters.created_by) {
    whereClause += ' AND created_by = ?';
    params.push(filters.created_by);
  }
  if (filters.start_time) {
    whereClause += ' AND created_at >= ?';
    params.push(parseInt(filters.start_time));
  }
  if (filters.end_time) {
    whereClause += ' AND created_at <= ?';
    params.push(parseInt(filters.end_time));
  }
  if (filters.is_overtime !== undefined) {
    whereClause += ' AND is_overtime = ?';
    params.push(filters.is_overtime ? 1 : 0);
  }

  const finalQuery = `SELECT * FROM tasks WHERE ${whereClause} ORDER BY created_at DESC`;
  const tasks = db.prepare(finalQuery).all(...params);

  const records = tasks.map(task => ({
    task_id: task.id,
    patient_name: task.patient_name,
    patient_id: task.patient_id,
    department: task.department,
    inspection_type: task.inspection_type,
    estimated_time: task.estimated_time,
    actual_duration: task.actual_duration || '',
    status: formatStatus(task.status),
    assigned_to: task.assigned_to || '',
    created_by: task.created_by,
    created_at: formatDate(task.created_at),
    accepted_at: formatDate(task.accepted_at),
    started_at: formatDate(task.started_at),
    completed_at: formatDate(task.completed_at),
    cancelled_at: formatDate(task.cancelled_at),
    cancelled_by: task.cancelled_by || '',
    cancel_reason: task.cancel_reason || '',
    queue_position: task.queue_position,
    is_overtime: task.is_overtime ? '是' : '否',
    overtime_reason: task.overtime_reason || ''
  }));

  const timestamp = Date.now();
  const filename = `tasks_export_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createCsvWriter({
    path: filepath,
    header: [
      { id: 'task_id', title: '任务ID' },
      { id: 'patient_name', title: '患者姓名' },
      { id: 'patient_id', title: '患者ID' },
      { id: 'department', title: '科室' },
      { id: 'inspection_type', title: '检查类型' },
      { id: 'estimated_time', title: '预计用时(分钟)' },
      { id: 'actual_duration', title: '实际用时(分钟)' },
      { id: 'status', title: '状态' },
      { id: 'assigned_to', title: '陪检员' },
      { id: 'created_by', title: '创建人' },
      { id: 'created_at', title: '创建时间' },
      { id: 'accepted_at', title: '接单时间' },
      { id: 'started_at', title: '开始时间' },
      { id: 'completed_at', title: '完成时间' },
      { id: 'cancelled_at', title: '取消时间' },
      { id: 'cancelled_by', title: '取消人' },
      { id: 'cancel_reason', title: '取消原因' },
      { id: 'queue_position', title: '排队位置' },
      { id: 'is_overtime', title: '是否超时' },
      { id: 'overtime_reason', title: '超时原因' }
    ]
  });

  await csvWriter.writeRecords(records);

  return {
    filepath,
    filename,
    record_count: records.length
  };
}

async function exportAuditToCSV(filters = {}) {
  const logs = queryAuditLogs(filters);

  const records = logs.map(log => ({
    log_id: log.id,
    task_id: log.task_id,
    action: formatAction(log.action),
    operator: log.operator,
    operator_role: formatRole(log.operator_role),
    old_status: formatStatus(log.old_status),
    new_status: formatStatus(log.new_status),
    details: log.details || '',
    error_type: log.error_type || '',
    error_message: log.error_message || '',
    created_at: formatDate(log.created_at)
  }));

  const timestamp = Date.now();
  const filename = `audit_export_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);

  const csvWriter = createCsvWriter({
    path: filepath,
    header: [
      { id: 'log_id', title: '日志ID' },
      { id: 'task_id', title: '任务ID' },
      { id: 'action', title: '操作类型' },
      { id: 'operator', title: '操作人' },
      { id: 'operator_role', title: '操作人角色' },
      { id: 'old_status', title: '原状态' },
      { id: 'new_status', title: '新状态' },
      { id: 'details', title: '详情' },
      { id: 'error_type', title: '异常类型' },
      { id: 'error_message', title: '异常信息' },
      { id: 'created_at', title: '操作时间' }
    ]
  });

  await csvWriter.writeRecords(records);

  return {
    filepath,
    filename,
    record_count: records.length
  };
}

function getStatistics(filters = {}) {
  let whereClause = '1=1';
  const params = [];

  if (filters.start_time) {
    whereClause += ' AND created_at >= ?';
    params.push(parseInt(filters.start_time));
  }
  if (filters.end_time) {
    whereClause += ' AND created_at <= ?';
    params.push(parseInt(filters.end_time));
  }

  const statusStats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM tasks
    WHERE ${whereClause}
    GROUP BY status
  `).all(...params);

  const overtimeStats = db.prepare(`
    SELECT 
      COUNT(*) as total_completed,
      SUM(CASE WHEN is_overtime = 1 THEN 1 ELSE 0 END) as overtime_count,
      AVG(actual_duration) as avg_duration,
      AVG(estimated_time) as avg_estimated
    FROM tasks
    WHERE status = 'completed' ${filters.start_time ? 'AND created_at >= ?' : ''} ${filters.end_time ? 'AND created_at <= ?' : ''}
  `).get(...params);

  const operatorStats = db.prepare(`
    SELECT assigned_to, COUNT(*) as task_count
    FROM tasks
    WHERE assigned_to IS NOT NULL AND ${whereClause}
    GROUP BY assigned_to
    ORDER BY task_count DESC
  `).all(...params);

  return {
    status_stats: statusStats.map(s => ({
      status: formatStatus(s.status),
      status_code: s.status,
      count: s.count
    })),
    completion_stats: {
      total_completed: overtimeStats.total_completed || 0,
      overtime_count: overtimeStats.overtime_count || 0,
      overtime_rate: overtimeStats.total_completed 
        ? ((overtimeStats.overtime_count / overtimeStats.total_completed) * 100).toFixed(2) + '%'
        : '0%',
      avg_actual_duration: Math.round(overtimeStats.avg_duration || 0),
      avg_estimated_duration: Math.round(overtimeStats.avg_estimated || 0)
    },
    operator_stats: operatorStats
  };
}

module.exports = {
  queryAuditLogs,
  exportTasksToCSV,
  exportAuditToCSV,
  getStatistics
};
