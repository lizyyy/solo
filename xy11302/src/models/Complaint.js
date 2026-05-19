const db = require('../config/database');

class Complaint {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { room_id, room_number, complaint_type, description, reporter_name, reporter_phone, handler_name, status, occurred_at, deduction_amount } = data;
      const sql = `INSERT INTO complaints 
        (room_id, room_number, complaint_type, description, reporter_name, reporter_phone, handler_name, status, occurred_at, deduction_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [room_id, room_number, complaint_type, description, reporter_name, reporter_phone, handler_name, status || 'pending', occurred_at, deduction_amount || 0], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM complaints WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM complaints WHERE 1=1';
      const params = [];

      if (filters.handler_name) {
        sql += ' AND handler_name LIKE ?';
        params.push(`%${filters.handler_name}%`);
      }
      if (filters.room_number) {
        sql += ' AND room_number LIKE ?';
        params.push(`%${filters.room_number}%`);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.complaint_type) {
        sql += ' AND complaint_type = ?';
        params.push(filters.complaint_type);
      }
      if (filters.start_date) {
        sql += ' AND occurred_at >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND occurred_at <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY occurred_at DESC, created_at DESC';

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

      const sql = `UPDATE complaints SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static handle(id, handler_name, status, handling_result, deduction_amount = 0) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE complaints 
        SET handler_name = ?, status = ?, handling_result = ?, deduction_amount = ?, handled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`;
      db.run(sql, [handler_name, status, handling_result, deduction_amount, id], function(err) {
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
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(deduction_amount) as total_deduction
        FROM complaints WHERE 1=1`;
      const params = [];

      if (dateRange.start) {
        sql += ' AND occurred_at >= ?';
        params.push(dateRange.start);
      }
      if (dateRange.end) {
        sql += ' AND occurred_at <= ?';
        params.push(dateRange.end);
      }

      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = Complaint;