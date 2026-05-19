const db = require('../config/database');
const moment = require('moment');

class Escort {
  static async create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO escorts (employee_id, name, phone, department, status)
         VALUES (?, ?, ?, ?, 'active')`,
        [data.employee_id, data.name, data.phone || null, data.department || null],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, employee_id: data.employee_id, name: data.name });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM escorts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findByEmployeeId(employeeId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM escorts WHERE employee_id = ?', [employeeId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findAll(status = 'active') {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM escorts';
      const params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY name';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async getAvailableEscorts(date, time) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT e.*, s.shift_type, s.start_time, s.end_time
         FROM escorts e
         JOIN schedules s ON e.id = s.escort_id
         WHERE s.date = ?
         AND e.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM tasks t
           WHERE t.escort_id = e.id
           AND t.status IN ('assigned', 'accepted', 'in_progress')
         )
         ORDER BY e.name`,
        [date],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async addSchedule(escortId, date, shiftType, startTime = null, endTime = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO schedules (escort_id, date, shift_type, start_time, end_time)
         VALUES (?, ?, ?, ?, ?)`,
        [escortId, date, shiftType, startTime, endTime],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  static async getSchedules(escortId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM schedules WHERE escort_id = ?';
      const params = [escortId];
      
      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY date';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Escort;
