const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function recordException(entityType, entityId, exceptionType, message) {
  const stmt = db.prepare(`
    INSERT INTO exceptions (id, entity_type, entity_id, exception_type, message, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  
  stmt.run(uuidv4(), entityType, entityId, exceptionType, message);
}

function getExceptions(options = {}) {
  let query = 'SELECT * FROM exceptions WHERE 1=1';
  const params = [];
  
  if (options.entityType) {
    query += ' AND entity_type = ?';
    params.push(options.entityType);
  }
  
  if (options.entityId) {
    query += ' AND entity_id = ?';
    params.push(options.entityId);
  }
  
  if (options.resolved === true) {
    query += ' AND resolved_at IS NOT NULL';
  } else if (options.resolved === false) {
    query += ' AND resolved_at IS NULL';
  }
  
  query += ' ORDER BY created_at DESC';
  
  return db.prepare(query).all(...params);
}

function resolveException(exceptionId, resolvedBy) {
  const stmt = db.prepare(`
    UPDATE exceptions 
    SET resolved_at = datetime('now'), resolved_by = ?
    WHERE id = ?
  `);
  
  const result = stmt.run(resolvedBy || 'system', exceptionId);
  return result.changes > 0;
}

module.exports = {
  recordException,
  getExceptions,
  resolveException
};
