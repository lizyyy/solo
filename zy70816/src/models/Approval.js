const db = require('../config/database');

class Approval {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { batch_id, action, status, reason, handler, notes, previous_status } = data;
      db.run(
        `INSERT INTO approvals (batch_id, action, status, reason, handler, notes, previous_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batch_id, action, status, reason, handler, notes, previous_status],
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
        `SELECT a.*, b.batch_no
         FROM approvals a
         LEFT JOIN batches b ON a.batch_id = b.id
         WHERE a.batch_id = ?
         ORDER BY a.created_at DESC`,
        [batch_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT a.*, b.batch_no, p.product_name
                 FROM approvals a
                 LEFT JOIN batches b ON a.batch_id = b.id
                 LEFT JOIN products p ON b.product_id = p.id
                 WHERE 1=1`;
      const params = [];

      if (filters.status) {
        sql += ` AND a.status = ?`;
        params.push(filters.status);
      }
      if (filters.handler) {
        sql += ` AND a.handler = ?`;
        params.push(filters.handler);
      }

      sql += ` ORDER BY a.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getApprovalHistory(batch_id) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT a.action, a.status, a.reason, a.handler, a.notes, a.created_at,
                a.previous_status, b.batch_no
         FROM approvals a
         LEFT JOIN batches b ON a.batch_id = b.id
         WHERE a.batch_id = ?
         ORDER BY a.created_at ASC`,
        [batch_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = Approval;
