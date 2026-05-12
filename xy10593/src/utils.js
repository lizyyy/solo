const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');
const { prepare } = require('./database');

const generateCode = (prefix) => {
  const timestamp = dayjs().format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss');

const addStatusHistory = (entityType, entityId, oldStatus, newStatus, action, operator, details = null) => {
  prepare(`
    INSERT INTO status_history (entity_type, entity_id, old_status, new_status, action, operator, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([entityType, entityId, oldStatus, newStatus, action, operator, details ? JSON.stringify(details) : null, now()]);
};

const addManualCorrection = (entityType, entityId, fieldName, oldValue, newValue, reason, operator) => {
  prepare(`
    INSERT INTO manual_corrections (entity_type, entity_id, field_name, old_value, new_value, reason, operator, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run([entityType, entityId, fieldName, oldValue ? String(oldValue) : null, String(newValue), reason, operator, now()]);
};

const getStatusHistory = (entityType, entityId) => {
  const rows = prepare(`
    SELECT * FROM status_history 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY created_at DESC
  `).all([entityType, entityId]);
  return rows.map(row => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));
};

const getManualCorrections = (entityType, entityId) => {
  return prepare(`
    SELECT * FROM manual_corrections 
    WHERE entity_type = ? AND entity_id = ? 
    ORDER BY created_at DESC
  `).all([entityType, entityId]);
};

const uuid = () => uuidv4();

module.exports = {
  generateCode,
  now,
  uuid,
  addStatusHistory,
  addManualCorrection,
  getStatusHistory,
  getManualCorrections
};
