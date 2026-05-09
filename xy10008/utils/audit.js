const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const logger = require('./logger');

const OPERATIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  READ: 'READ'
};

const ENTITY_TYPES = {
  BILL: 'BILL',
  BILL_SPLIT: 'BILL_SPLIT',
  USER: 'USER',
  TASK: 'TASK'
};

const logAudit = (operation, entityType, entityId, oldValue, newValue, req = {}) => {
  try {
    const headers = req.headers || {};
    const log = db.prepare(`
      INSERT INTO audit_logs (
        id, operation, entity_type, entity_id, old_value, new_value, 
        performed_by, timestamp, request_id, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      operation,
      entityType,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      req.user?.id || headers['x-user-id'] || 'system',
      Date.now(),
      req.idempotencyKey || headers['x-request-id'] || null,
      req.ip || null,
      headers['user-agent'] || null
    );
    
    logger.info('Audit log created', {
      operation,
      entityType,
      entityId,
      logId: log.lastInsertRowid
    });
    
    return log;
  } catch (error) {
    logger.error('Failed to create audit log', { error: error.message });
    throw error;
  }
};

const getAuditLogs = (entityType, entityId, limit = 100, offset = 0) => {
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];
  
  if (entityType) {
    query += ' AND entity_type = ?';
    params.push(entityType);
  }
  
  if (entityId) {
    query += ' AND entity_id = ?';
    params.push(entityId);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  return db.prepare(query).all(...params).map(log => ({
    ...log,
    old_value: log.old_value ? JSON.parse(log.old_value) : null,
    new_value: log.new_value ? JSON.parse(log.new_value) : null
  }));
};

const getAuditStats = () => {
  const stats = db.prepare(`
    SELECT 
      operation,
      entity_type,
      COUNT(*) as count
    FROM audit_logs
    GROUP BY operation, entity_type
    ORDER BY count DESC
  `).all();
  
  return stats;
};

module.exports = {
  logAudit,
  getAuditLogs,
  getAuditStats,
  OPERATIONS,
  ENTITY_TYPES
};
