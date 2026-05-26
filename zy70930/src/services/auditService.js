const { v4: uuidv4 } = require('uuid');
const db = require('../database');

const ACTIONS = {
  BATCH_CREATED: 'batch_created',
  BATCH_STATUS_CHANGED: 'batch_status_changed',
  DATA_IMPORTED: 'data_imported',
  RECONCILIATION_RUN: 'reconciliation_run',
  RECORD_REVIEWED: 'record_reviewed',
  DISCREPANCY_RESOLVED: 'discrepancy_resolved',
  BATCH_COMPLETED: 'batch_completed',
  REPORT_EXPORTED: 'report_exported',
  DATA_DELETED: 'data_deleted'
};

async function logAction(userId, userName, action, details = {}, oldValue = null, newValue = null, batchId = null, recordId = null, ipAddress = null) {
  const id = uuidv4();
  await db.run(`
    INSERT INTO audit_logs
    (id, batch_id, record_id, user_id, user_name, action, action_details, old_value, new_value, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    batchId,
    recordId,
    userId,
    userName,
    action,
    JSON.stringify(details),
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    ipAddress
  ]);
  return id;
}

async function getAuditLogs(batchId = null, userId = null, action = null, limit = 100, offset = 0) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (batchId) {
    sql += ' AND batch_id = ?';
    params.push(batchId);
  }
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (action) {
    sql += ' AND action = ?';
    params.push(action);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return await db.all(sql, params);
}

async function getAuditStats(batchId) {
  const logs = await getAuditLogs(batchId);
  const stats = {};

  for (const log of logs) {
    if (!stats[log.action]) {
      stats[log.action] = {
        count: 0,
        users: new Set(),
        latest: null
      };
    }
    stats[log.action].count++;
    stats[log.action].users.add(log.user_name);
    if (!stats[log.action].latest === null || log.created_at > stats[log.action].latest) {
      stats[log.action].latest = log.created_at;
    }
  }

  return stats;
}

module.exports = {
  logAction,
  getAuditLogs,
  getAuditStats,
  ACTIONS
};
