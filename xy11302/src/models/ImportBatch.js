const db = require('../config/database');

class ImportBatch {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { batch_number, file_name, total_records, normal_records, abnormal_records, imported_by, status } = data;
      const sql = `INSERT INTO import_batches 
        (batch_number, file_name, total_records, normal_records, abnormal_records, imported_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [batch_number, file_name, total_records || 0, normal_records || 0, abnormal_records || 0, imported_by, status || 'completed'], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM import_batches WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findByBatchNumber(batch_number) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM import_batches WHERE batch_number = ?', [batch_number], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM import_batches WHERE 1=1';
      const params = [];

      if (filters.imported_by) {
        sql += ' AND imported_by LIKE ?';
        params.push(`%${filters.imported_by}%`);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      sql += ' ORDER BY imported_at DESC LIMIT 50';

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static generateBatchNumber() {
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    return `IMP${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${timestamp}`;
  }
}

module.exports = ImportBatch;