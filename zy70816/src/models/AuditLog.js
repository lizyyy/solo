const db = require('../config/database');

class AuditLog {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { batch_id, action, old_value, new_value, operator, ip_address } = data;
      db.run(
        `INSERT INTO audit_logs (batch_id, action, old_value, new_value, operator, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [batch_id, action, old_value, new_value, operator, ip_address],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findByBatchId(batch_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY created_at DESC`,
        [batch_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static findAll(limit = 100) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT a.*, b.batch_no FROM audit_logs a
         LEFT JOIN batches b ON a.batch_id = b.id
         ORDER BY a.created_at DESC LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = AuditLog;
