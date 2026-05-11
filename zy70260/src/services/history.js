const { getDb } = require('../database');
const {
  ENTITY_TYPES,
  OPERATIONS,
  safeJsonStringify,
  safeJsonParse
} = require('../utils');

class HistoryService {
  static record(entityType, entityId, operation, beforeValue = null, afterValue = null, operator = 'SYSTEM') {
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO history_record (entity_type, entity_id, operation, before_value, after_value, operator)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entityType,
      entityId,
      operation,
      safeJsonStringify(beforeValue),
      safeJsonStringify(afterValue),
      operator
    );
  }

  static getByEntity(entityType, entityId, limit = 50) {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT * FROM history_record
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);
    
    return stmt.all(entityType, entityId, limit).map(row => ({
      ...row,
      before_value: safeJsonParse(row.before_value),
      after_value: safeJsonParse(row.after_value)
    }));
  }

  static getAll(entityType = null, limit = 100) {
    const db = getDb();
    let query = 'SELECT * FROM history_record';
    const params = [];
    
    if (entityType) {
      query += ' WHERE entity_type = ?';
      params.push(entityType);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const stmt = db.prepare(query);
    return stmt.all(...params).map(row => ({
      ...row,
      before_value: safeJsonParse(row.before_value),
      after_value: safeJsonParse(row.after_value)
    }));
  }
}

module.exports = HistoryService;
