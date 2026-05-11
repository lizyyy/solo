const db = require('../config/database');
const { PRESCRIPTION_STATUS } = require('../utils/enums');
const { v4: uuidv4 } = require('uuid');

class Prescription {
  static create(prescription) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { doctorName, patientName, clinic, toothPosition, dentureType, dueDate, notes } = prescription;
      const now = Date.now();
      
      const stmt = db.prepare(`
        INSERT INTO prescriptions (
          id, doctor_name, patient_name, clinic, tooth_position, denture_type,
          due_date, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, doctorName, patientName, clinic, toothPosition, dentureType,
        dueDate, notes, PRESCRIPTION_STATUS.PENDING, now, now,
        function(err) {
          if (err) return reject(err);
          resolve({ id, ...prescription, status: PRESCRIPTION_STATUS.PENDING, createdAt: now, updatedAt: now });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM prescriptions WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? this._mapRow(row) : null);
      });
    });
  }

  static findAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM prescriptions WHERE 1=1';
      const queryParams = [];
      
      if (params.status) {
        sql += ' AND status = ?';
        queryParams.push(params.status);
      }
      if (params.doctorName) {
        sql += ' AND doctor_name LIKE ?';
        queryParams.push(`%${params.doctorName}%`);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, queryParams, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static updateStatus(id, status) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const stmt = db.prepare('UPDATE prescriptions SET status = ?, updated_at = ? WHERE id = ?');
      stmt.run(status, now, id, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static updateReturnCount(id) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const stmt = db.prepare('UPDATE prescriptions SET return_count = return_count + 1, updated_at = ? WHERE id = ?');
      stmt.run(now, id, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static _mapRow(row) {
    return {
      id: row.id,
      doctorName: row.doctor_name,
      patientName: row.patient_name,
      clinic: row.clinic,
      toothPosition: row.tooth_position,
      dentureType: row.denture_type,
      dueDate: row.due_date,
      notes: row.notes,
      status: row.status,
      returnCount: row.return_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Prescription;
