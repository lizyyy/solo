const db = require('../database/db');

function logAudit(tableName, recordId, action, oldValues, newValues, changedBy) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        tableName,
        recordId,
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        changedBy
      ],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

module.exports = { logAudit };
