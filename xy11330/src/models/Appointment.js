const db = require('../config/database');
const moment = require('moment');

class Appointment {
  static async create(data) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO appointments 
         (appointment_no, patient_name, patient_id, phone, department, 
          exam_type, appointment_date, appointment_time, priority, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.appointment_no,
          data.patient_name,
          data.patient_id || null,
          data.phone || null,
          data.department || null,
          data.exam_type || null,
          data.appointment_date,
          data.appointment_time,
          data.priority || 0,
          data.notes || null
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, appointment_no: data.appointment_no });
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM appointments WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findByAppointmentNo(appointmentNo) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM appointments WHERE appointment_no = ?', [appointmentNo], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM appointments WHERE 1=1';
      const params = [];
      
      if (filters.date) {
        query += ' AND appointment_date = ?';
        params.push(filters.date);
      }
      
      if (filters.status) {
        query += ' AND status = ?';
        params.push(filters.status);
      }
      
      if (filters.department) {
        query += ' AND department = ?';
        params.push(filters.department);
      }
      
      query += ' ORDER BY appointment_date, appointment_time';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?',
        [status, moment().format(), id],
        function(err) {
          if (err) reject(err);
          else resolve({ success: true, changes: this.changes });
        }
      );
    });
  }
}

module.exports = Appointment;
