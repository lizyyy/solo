const db = require('../config/database');

class Recall {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { recall_no, title, content, batch_nos, reason, level, published_date, publisher } = data;
      db.run(
        `INSERT INTO recalls (recall_no, title, content, batch_nos, reason, level, published_date, publisher)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [recall_no, title, content, batch_nos, reason, level, published_date, publisher],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...data });
        }
      );
    });
  }

  static findAll(status) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM recalls`;
      const params = [];
      if (status) {
        sql += ` WHERE status = ?`;
        params.push(status);
      }
      sql += ` ORDER BY created_at DESC`;
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static getAffectedBatches() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, b.batch_no, b.product_id, b.supplier_id, b.status, b.is_frozen,
                p.product_name, s.supplier_name
         FROM recalls r
         LEFT JOIN batches b ON r.batch_nos LIKE '%' || b.batch_no || '%'
         LEFT JOIN products p ON b.product_id = p.id
         LEFT JOIN suppliers s ON b.supplier_id = s.id
         WHERE r.status = 'active'
         ORDER BY r.created_at DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = Recall;
