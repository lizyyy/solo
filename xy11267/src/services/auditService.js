const { runQuery, allQuery, getQuery } = require('../database/db');

async function logAction(actionType, recordId, operator, role, actionDetails, ipAddress = null) {
  await runQuery(`
    INSERT INTO audit_logs (action_type, record_id, operator, role, action_details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [actionType, recordId, operator, role, actionDetails, ipAddress]);
}

async function getAuditLogs(filters = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.action_type) {
    sql += ' AND action_type = ?';
    params.push(filters.action_type);
  }
  if (filters.record_id) {
    sql += ' AND record_id = ?';
    params.push(filters.record_id);
  }
  if (filters.operator) {
    sql += ' AND operator LIKE ?';
    params.push(`%${filters.operator}%`);
  }
  if (filters.start_date) {
    sql += ' AND created_at >= ?';
    params.push(filters.start_date);
  }
  if (filters.end_date) {
    sql += ' AND created_at <= ?';
    params.push(filters.end_date);
  }

  sql += ' ORDER BY created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return await allQuery(sql, params);
}

async function getAuditLogCount(filters = {}) {
  let sql = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.action_type) {
    sql += ' AND action_type = ?';
    params.push(filters.action_type);
  }
  if (filters.record_id) {
    sql += ' AND record_id = ?';
    params.push(filters.record_id);
  }
  if (filters.operator) {
    sql += ' AND operator LIKE ?';
    params.push(`%${filters.operator}%`);
  }

  const result = await getQuery(sql, params);
  return result.count;
}

module.exports = { logAction, getAuditLogs, getAuditLogCount };
