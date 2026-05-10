const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const recordHistory = (entityType, entityId, operationType, beforeState, afterState, reason, operator) => {
  const stmt = db.prepare(`
    INSERT INTO operation_history (id, entity_type, entity_id, operation_type, before_state, after_state, reason, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    uuidv4(),
    entityType,
    entityId,
    operationType,
    beforeState ? JSON.stringify(beforeState) : null,
    afterState ? JSON.stringify(afterState) : null,
    reason || null,
    operator || 'system',
    new Date().toISOString()
  );
};

const getHistoryByEntity = (entityType, entityId) => {
  const stmt = db.prepare(`
    SELECT * FROM operation_history
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at ASC
  `);

  const rows = stmt.all(entityType, entityId);
  return rows.map(row => ({
    ...row,
    before_state: row.before_state ? JSON.parse(row.before_state) : null,
    after_state: row.after_state ? JSON.parse(row.after_state) : null
  }));
};

const getAllHistory = () => {
  const rows = db.prepare(`
    SELECT * FROM operation_history
    ORDER BY created_at ASC
  `).all();

  return rows.map(row => ({
    ...row,
    before_state: row.before_state ? JSON.parse(row.before_state) : null,
    after_state: row.after_state ? JSON.parse(row.after_state) : null
  }));
};

module.exports = { recordHistory, getHistoryByEntity, getAllHistory };
