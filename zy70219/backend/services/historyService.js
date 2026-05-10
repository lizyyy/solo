const db = require('../config/db');

const entityTypes = {
  RESERVATION: 'reservation',
  EQUIPMENT_BOOKING: 'equipment_booking',
  CLEANING_WINDOW: 'cleaning_window',
  FIRE_INSPECTION: 'fire_inspection',
  APPROVAL: 'approval'
};

const actions = {
  CREATE: 'create',
  UPDATE: 'update',
  STATUS_CHANGE: 'status_change',
  DELETE: 'delete',
  APPROVE: 'approve',
  REJECT: 'reject',
  SUBMIT: 'submit'
};

function logHistory(entityType, entityId, action, oldValue, newValue, operator = 'system') {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO history_logs (entity_type, entity_id, action, old_value, new_value, operator)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [entityType, entityId, action, 
       oldValue ? JSON.stringify(oldValue) : null, 
       newValue ? JSON.stringify(newValue) : null, 
       operator],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getHistory(entityType, entityId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM history_logs 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC`,
      [entityType, entityId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          old_value: row.old_value ? JSON.parse(row.old_value) : null,
          new_value: row.new_value ? JSON.parse(row.new_value) : null
        })));
      }
    );
  });
}

module.exports = {
  entityTypes,
  actions,
  logHistory,
  getHistory
};
