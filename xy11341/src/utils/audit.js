const db = require('../db');
const { maskLogEntry } = require('./mask');

function logAction(action, entityType, { entityId = null, entityNo = null, beforeData = null, afterData = null, operator = 'system' } = {}) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (action, entity_type, entity_id, entity_no, before_data, after_data, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const beforeJson = beforeData ? maskLogEntry(JSON.stringify(beforeData)) : null;
  const afterJson = afterData ? maskLogEntry(JSON.stringify(afterData)) : null;

  return stmt.run(action, entityType, entityId, entityNo, beforeJson, afterJson, operator);
}

function getLogs(entityType = null, limit = 100) {
  let sql = 'SELECT * FROM audit_logs';
  const params = [];

  if (entityType) {
    sql += ' WHERE entity_type = ?';
    params.push(entityType);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

module.exports = {
  logAction,
  getLogs,
};
