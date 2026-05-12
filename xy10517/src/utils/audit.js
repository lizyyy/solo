const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../database/connection');

function createAuditLog(entityType, entityId, action, beforeValue, afterValue, operator, reason = '') {
  const db = getDB();
  
  const logId = uuidv4();
  
  db.prepare(`
    INSERT INTO audit_logs (
      id, entity_type, entity_id, action, before_value, after_value, operator, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    logId,
    entityType,
    entityId,
    action,
    beforeValue ? JSON.stringify(beforeValue) : null,
    afterValue ? JSON.stringify(afterValue) : null,
    operator,
    reason
  );
  
  return logId;
}

function getAuditLogs(entityType, entityId, limit = 50) {
  const db = getDB();
  
  return db.prepare(`
    SELECT * FROM audit_logs 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(entityType, entityId, limit).map(log => ({
    ...log,
    before_value: log.before_value ? JSON.parse(log.before_value) : null,
    after_value: log.after_value ? JSON.parse(log.after_value) : null
  }));
}

function getAllAuditLogs(limit = 100) {
  const db = getDB();
  
  return db.prepare(`
    SELECT * FROM audit_logs 
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit).map(log => ({
    ...log,
    before_value: log.before_value ? JSON.parse(log.before_value) : null,
    after_value: log.after_value ? JSON.parse(log.after_value) : null
  }));
}

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAllAuditLogs
};
