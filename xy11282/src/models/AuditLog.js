const db = require('../config/database');

class AuditLog {
  static create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_logs (type, targetId, action, operator, reason, oldValue, newValue)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [data.type, data.targetId, data.action, data.operator, data.reason, 
         data.oldValue ? JSON.stringify(data.oldValue) : null,
         data.newValue ? JSON.stringify(data.newValue) : null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM audit_logs WHERE 1=1`;
      const params = [];
      
      if (filters.type) {
        query += ` AND type = ?`;
        params.push(filters.type);
      }
      
      if (filters.targetId) {
        query += ` AND targetId = ?`;
        params.push(filters.targetId);
      }
      
      query += ` ORDER BY createdAt DESC`;
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          oldValue: row.oldValue ? JSON.parse(row.oldValue) : null,
          newValue: row.newValue ? JSON.parse(row.newValue) : null
        })));
      });
    });
  }
}

module.exports = AuditLog;
