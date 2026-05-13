const db = require('../models/database');

class LogService {
  static logOperation(entityType, entityId, action, operatorId, operatorName, beforeValue, afterValue) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO operation_logs (entity_type, entity_id, action, operator_id, operator_name, before_value, after_value) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [entityType, entityId, action, operatorId, operatorName, 
        beforeValue ? JSON.stringify(beforeValue) : null, 
        afterValue ? JSON.stringify(afterValue) : null], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static logModification(entityType, entityId, fieldName, oldValue, newValue, operatorId, operatorName) {
    return new Promise((resolve, reject) => {
      const sql = `INSERT INTO modification_history (entity_type, entity_id, field_name, old_value, new_value, operator_id, operator_name) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [entityType, entityId, fieldName, 
        oldValue !== undefined && oldValue !== null ? String(oldValue) : null, 
        newValue !== undefined && newValue !== null ? String(newValue) : null, 
        operatorId, operatorName], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static getOperationLogs(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM operation_logs WHERE 1=1`;
      const params = [];

      if (filters.operatorName) {
        sql += ` AND operator_name LIKE ?`;
        params.push(`%${filters.operatorName}%`);
      }
      if (filters.startTime) {
        sql += ` AND created_at >= ?`;
        params.push(filters.startTime);
      }
      if (filters.endTime) {
        sql += ` AND created_at <= ?`;
        params.push(filters.endTime);
      }

      sql += ` ORDER BY created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getModificationHistory(entityType, entityId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM modification_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC`;
      db.all(sql, [entityType, entityId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = LogService;
