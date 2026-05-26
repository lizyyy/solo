const db = require('../config/database');

class OperationLogModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO operation_logs 
        (rental_id, batch_id, operation_type, operator, reason, old_status, new_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.rental_id, data.batch_id, data.operation_type,
        data.operator, data.reason, data.old_status, data.new_status
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findByRentalId(rentalId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM operation_logs WHERE rental_id = ? ORDER BY created_at DESC', [rentalId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByBatch(batchId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY created_at DESC', [batchId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM operation_logs ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = OperationLogModel;
