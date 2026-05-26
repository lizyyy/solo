const db = require('../config/database');

class BatchModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO batches (batch_id, batch_name, total_count, operator)
        VALUES (?, ?, ?, ?)
      `;
      const params = [data.batch_id, data.batch_name, data.total_count, data.operator];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static updateProcessedCount(batchId, count) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE batches 
        SET processed_count = processed_count + ?,
            status = CASE 
              WHEN processed_count + ? >= total_count THEN 'completed'
              ELSE 'processing'
            END
        WHERE batch_id = ?
      `;
      db.run(sql, [count, count, batchId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static findById(batchId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE batch_id = ?', [batchId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM batches ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = BatchModel;
