const { v4: uuidv4 } = require('uuid');
const { db } = require('../database/db');

function recordHistory(entityType, entityId, oldStatus, newStatus, changedBy, reason, diff) {
  const stmt = db.prepare(`
    INSERT INTO status_history (id, entity_type, entity_id, old_status, new_status, changed_by, reason, diff_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  stmt.run(
    uuidv4(),
    entityType,
    entityId,
    oldStatus || null,
    newStatus,
    changedBy || 'system',
    reason || null,
    diff ? JSON.stringify(diff) : null
  );
}

function getHistory(entityType, entityId) {
  const stmt = db.prepare(`
    SELECT * FROM status_history 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(entityType, entityId);
}

function getAllHistory() {
  const stmt = db.prepare(`
    SELECT * FROM status_history
    ORDER BY created_at DESC
    LIMIT 100
  `);
  
  return stmt.all();
}

module.exports = {
  recordHistory,
  getHistory,
  getAllHistory
};
