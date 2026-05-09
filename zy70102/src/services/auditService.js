const { getDb } = require('../database/connection');

const logEvent = (eventType, { deviceId, commandId, operator, action, detail }) => {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO audit_logs (event_type, device_id, command_id, operator, action, detail)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(eventType, deviceId || null, commandId || null, operator || null, action || null, detail || null);
  return result.lastInsertRowid;
};

const getAuditLogs = (filters = {}) => {
  const db = getDb();
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.eventType) {
    sql += ' AND event_type = ?';
    params.push(filters.eventType);
  }
  if (filters.deviceId) {
    sql += ' AND device_id = ?';
    params.push(filters.deviceId);
  }
  if (filters.commandId) {
    sql += ' AND command_id = ?';
    params.push(filters.commandId);
  }
  if (filters.startTime) {
    sql += ' AND created_at >= ?';
    params.push(filters.startTime);
  }
  if (filters.endTime) {
    sql += ' AND created_at <= ?';
    params.push(filters.endTime);
  }

  sql += ' ORDER BY created_at DESC';
  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return db.prepare(sql).all(...params);
};

const getAuditByCommandId = (commandId) => {
  const db = getDb();
  return db.prepare('SELECT * FROM audit_logs WHERE command_id = ? ORDER BY created_at ASC').all(commandId);
};

module.exports = {
  logEvent,
  getAuditLogs,
  getAuditByCommandId,
};
