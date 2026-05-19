const db = require('../config/database');

class CleaningRecord {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { room_id, room_number, cleaner_name, check_date, check_time, status, photo_urls, quality_score, has_issue, issue_description } = data;
      const sql = `INSERT INTO cleaning_records 
        (room_id, room_number, cleaner_name, check_date, check_time, status, photo_urls, quality_score, has_issue, issue_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [room_id, room_number, cleaner_name, check_date, check_time, status || 'pending', photo_urls, quality_score, has_issue || 0, issue_description], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM cleaning_records WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM cleaning_records WHERE 1=1';
      const params = [];

      if (filters.cleaner_name) {
        sql += ' AND cleaner_name LIKE ?';
        params.push(`%${filters.cleaner_name}%`);
      }
      if (filters.room_number) {
        sql += ' AND room_number LIKE ?';
        params.push(`%${filters.room_number}%`);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.has_issue !== undefined) {
        sql += ' AND has_issue = ?';
        params.push(filters.has_issue);
      }
      if (filters.start_date) {
        sql += ' AND check_date >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND check_date <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY check_date DESC, created_at DESC';

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

      const sql = `UPDATE cleaning_records SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static review(id, reviewer_name, status, issue_description = null) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE cleaning_records 
        SET status = ?, reviewer_name = ?, reviewed_at = CURRENT_TIMESTAMP, issue_description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [status, reviewer_name, issue_description, id], function(err) {
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
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN has_issue = 1 THEN 1 ELSE 0 END) as has_issue
        FROM cleaning_records WHERE 1=1`;
      const params = [];

      if (dateRange.start) {
        sql += ' AND check_date >= ?';
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        sql += ' AND check_date <= ?';
        params.push(dateRange.end);
      }

      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = CleaningRecord;