const db = require('../config/database');

class BatchModel {
  static create(batchData) {
    return new Promise((resolve, reject) => {
      const { batch_no, check_date, created_by } = batchData;
      db.run(
        `INSERT INTO batches (batch_no, check_date, created_by) VALUES (?, ?, ?)`,
        [batch_no, check_date, created_by],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...batchData });
        }
      );
    });
  }

  static findByNo(batch_no) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM batches WHERE batch_no = ?`, [batch_no], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT * FROM batches WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static updateCounts(batch_id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE batches SET 
          total_count = (SELECT COUNT(*) FROM check_records WHERE batch_id = ?),
          normal_count = (SELECT COUNT(*) FROM check_records WHERE batch_id = ? AND status = 'normal'),
          pending_count = (SELECT COUNT(*) FROM check_records WHERE batch_id = ? AND status = 'pending'),
          blocked_count = (SELECT COUNT(*) FROM check_records WHERE batch_id = ? AND status = 'blocked'),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [batch_id, batch_id, batch_id, batch_id, batch_id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });
  }

  static list(page = 1, pageSize = 20) {
    return new Promise((resolve, reject) => {
      const offset = (page - 1) * pageSize;
      db.all(
        `SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [pageSize, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = BatchModel;