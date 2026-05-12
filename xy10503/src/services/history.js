const db = require('../config/database');

function addStatusHistory(entityType, entityId, oldStatus, newStatus, operator, remark) {
  db.prepare(`
    INSERT INTO status_history (id, entity_type, entity_id, old_status, new_status, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entityType,
    entityId,
    oldStatus,
    newStatus,
    operator,
    remark
  );
}

function getStatusHistory(entityType, entityId) {
  return db.prepare(`
    SELECT * FROM status_history
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at ASC
  `).all(entityType, entityId);
}

function addManualCorrection(entityType, entityId, fieldName, oldValue, newValue, reason, operator) {
  db.prepare(`
    INSERT INTO manual_corrections (id, entity_type, entity_id, field_name, old_value, new_value, reason, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entityType,
    entityId,
    fieldName,
    oldValue ? String(oldValue) : null,
    newValue ? String(newValue) : null,
    reason,
    operator
  );
}

function getManualCorrections(entityType, entityId) {
  return db.prepare(`
    SELECT * FROM manual_corrections
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at ASC
  `).all(entityType, entityId);
}

module.exports = {
  addStatusHistory,
  getStatusHistory,
  addManualCorrection,
  getManualCorrections
};
