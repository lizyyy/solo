const { run, get, all } = require('../db');

const ACTIONS = {
  EVENT_RECEIVED: 'event_received',
  EVENT_SIGNATURE_FAILED: 'signature_failed',
  EVENT_TIMESTAMP_EXPIRED: 'timestamp_expired',
  EVENT_DUPLICATE: 'event_duplicate',
  EVENT_PROCESSED: 'event_processed',
  EVENT_FAILED: 'event_failed',
  EVENT_RETRIED: 'event_retried',
  EVENT_REPLAYED: 'event_replayed',
  EVENT_DISCARDED: 'event_discarded',
  PROVIDER_CREATED: 'provider_created',
  PROVIDER_UPDATED: 'provider_updated',
  PROVIDER_DELETED: 'provider_deleted',
  SIMULATOR_CONFIG_UPDATED: 'simulator_config_updated',
  BATCH_REPLAY_STARTED: 'batch_replay_started',
};

async function createAuditLog(action, entityType, entityId, details, triggeredBy = 'system') {
  return run(`
    INSERT INTO audit_logs (action, entity_type, entity_id, details, triggered_by)
    VALUES (?, ?, ?, ?, ?)
  `, [
    action,
    entityType,
    entityId || null,
    details ? JSON.stringify(details) : null,
    triggeredBy
  ]);
}

async function getAuditLogs(filters = {}) {
  const conditions = [];
  const values = [];
  
  if (filters.action) {
    conditions.push('action = ?');
    values.push(filters.action);
  }
  if (filters.entity_type) {
    conditions.push('entity_type = ?');
    values.push(filters.entity_type);
  }
  if (filters.entity_id) {
    conditions.push('entity_id = ?');
    values.push(filters.entity_id);
  }
  if (filters.since) {
    conditions.push('created_at >= ?');
    values.push(filters.since);
  }
  if (filters.until) {
    conditions.push('created_at <= ?');
    values.push(filters.until);
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ? `LIMIT ${parseInt(filters.limit)}` : '';
  
  return all(`
    SELECT * FROM audit_logs ${where} ORDER BY created_at DESC ${limit}
  `, values);
}

async function getAuditStats(since, until) {
  let sql = `
    SELECT 
      action,
      COUNT(*) as count
    FROM audit_logs
    WHERE 1=1
  `;
  const values = [];
  
  if (since) {
    sql += ' AND created_at >= ?';
    values.push(since);
  }
  if (until) {
    sql += ' AND created_at <= ?';
    values.push(until);
  }
  
  sql += ' GROUP BY action ORDER BY count DESC';
  
  return all(sql, values);
}

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditStats,
  ACTIONS,
};
