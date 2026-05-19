const db = require('../config/database');

class Batch {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { batch_no, product_id, supplier_id, production_date, expiry_date, quantity, created_by } = data;
      db.run(
        `INSERT INTO batches (batch_no, product_id, supplier_id, production_date, expiry_date, quantity, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [batch_no, product_id, supplier_id, production_date, expiry_date, quantity, created_by],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findByNo(batch_no) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT b.*, p.product_name, p.product_code, s.supplier_name
         FROM batches b
         LEFT JOIN products p ON b.product_id = p.id
         LEFT JOIN suppliers s ON b.supplier_id = s.id
         WHERE b.batch_no = ?`,
        [batch_no],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT b.*, p.product_name, p.product_code, s.supplier_name
                 FROM batches b
                 LEFT JOIN products p ON b.product_id = p.id
                 LEFT JOIN suppliers s ON b.supplier_id = s.id
                 WHERE 1=1`;
      const params = [];

      if (filters.status) {
        sql += ` AND b.status = ?`;
        params.push(filters.status);
      }
      if (filters.is_frozen !== undefined) {
        sql += ` AND b.is_frozen = ?`;
        params.push(filters.is_frozen ? 1 : 0);
      }
      if (filters.product_id) {
        sql += ` AND b.product_id = ?`;
        params.push(filters.product_id);
      }

      sql += ` ORDER BY b.created_at DESC`;

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static freeze(batch_no, reason, frozen_by) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE batches SET is_frozen = 1, frozen_reason = ?, frozen_by = ?, frozen_at = CURRENT_TIMESTAMP WHERE batch_no = ?`,
        [reason, frozen_by, batch_no],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static unfreeze(batch_no) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE batches SET is_frozen = 0, frozen_reason = NULL, frozen_by = NULL, frozen_at = NULL WHERE batch_no = ?`,
        [batch_no],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static updateStatus(batch_no, status) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE batches SET status = ? WHERE batch_no = ?`,
        [status, batch_no],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  static getExpiringBatches(days = 30) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT b.*, p.product_name, p.product_code, s.supplier_name,
                julianday(b.expiry_date) - julianday('now') as days_until_expiry
         FROM batches b
         LEFT JOIN products p ON b.product_id = p.id
         LEFT JOIN suppliers s ON b.supplier_id = s.id
         WHERE b.expiry_date IS NOT NULL
         AND julianday(b.expiry_date) - julianday('now') <= ?
         AND julianday(b.expiry_date) - julianday('now') > 0
         AND b.is_frozen = 0
         ORDER BY days_until_expiry ASC`,
        [days],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = Batch;
