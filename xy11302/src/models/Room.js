const db = require('../config/database');

class Room {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { room_number, room_type, floor, status } = data;
      const sql = `INSERT INTO rooms (room_number, room_type, floor, status) VALUES (?, ?, ?, ?)`;
      db.run(sql, [room_number, room_type, floor, status || 'active'], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rooms WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findByNumber(room_number) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rooms WHERE room_number = ?', [room_number], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rooms WHERE 1=1';
      const params = [];

      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.floor) {
        sql += ' AND floor = ?';
        params.push(filters.floor);
      }

      sql += ' ORDER BY room_number ASC';

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

      const sql = `UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`;
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }

  static delete(id) {
    return new Promise((resolve, reject) => {
      db.run('UPDATE rooms SET status = ? WHERE id = ?', ['inactive', id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  }
}

module.exports = Room;