const db = require('../config/database');

class Rework {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { cleaning_record_id, room_number, original_cleaner, reworker_name, reason, status, rework_date, deduction_amount } = data;
      const sql = `INSERT INTO reworks 
        (cleaning_record_id, room_number, original_cleaner, reworker_name, reason, status, rework_date, deduction_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [cleaning_record_id, room_number, original_cleaner, reworker_name, reason, status || 'pending', rework_date, deduction_amount || 0], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM reworks WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM reworks WHERE 1=1';
      const params = [];

      if (filters.original_cleaner) {
        sql += ' AND original_cleaner LIKE ?';
        params.push(`%${filters.original_cleaner}%`);
      }
      if (filters.reworker_name) {
        sql += ' AND reworker_name LIKE ?';
        params.push(`%${filters.reworker_name}%`);
      }
      if (filters.room_number) {
        sql += ' AND room_number LIKE ?';
        params.push(`%${filters.room_number}%`);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.start_date) {
        sql += ' AND rework_date >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND rework_date <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY rework_date DESC, created_at DESC';

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];
      
      Object.keys(data).forEach(key => {
        if (key !== 'id' && key !== 'created_at') {
          fields.push(`${key} = ?`);
          values.push(data[key]);
        }
      });
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      const sql = `UPDATE reworks SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static review(id, reviewer_name, status, deduction_amount = 0) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE reworks 
        SET reviewer_name = ?, status = ?, reviewed_at = CURRENT_TIMESTAMP, deduction_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [reviewer_name, status, deduction_amount, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static getStats(dateRange = {}) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(deduction_amount) as total_deduction
        FROM reworks WHERE 1=1`;
      const params = [];

      if (dateRange.start) {
        sql += ' AND rework_date >= ?';
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        sql += ' AND rework_date <= ?';
        params.push(dateRange.end);
      }

      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = Rework;