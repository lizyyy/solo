const db = require('../config/database');
const { BATCH_STATUS } = require('../utils/enums');
const { v4: uuidv4 } = require('uuid');

class Batch {
  static create(batch) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { prescriptionId, batchNumber, modelNumber, technician, expectedFinishDate, notes } = batch;
      const now = Date.now();
      
      const stmt = db.prepare(`
        INSERT INTO batches (
          id, prescription_id, batch_number, model_number, technician,
          expected_finish_date, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, prescriptionId, batchNumber, modelNumber, technician,
        expectedFinishDate, notes, BATCH_STATUS.CREATED, now, now,
        function(err) {
          if (err) return reject(err);
          resolve({
            id,
            prescriptionId,
            batchNumber,
            modelNumber,
            technician,
            expectedFinishDate,
            notes,
            status: BATCH_STATUS.CREATED,
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM batches WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? this._mapRow(row) : null);
      });
    });
  }

  static findByPrescriptionId(prescriptionId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM batches WHERE prescription_id = ? ORDER BY created_at DESC', [prescriptionId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static findAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM batches WHERE 1=1';
      const queryParams = [];
      
      if (params.status) {
        sql += ' AND status = ?';
        queryParams.push(params.status);
      }
      if (params.technician) {
        sql += ' AND technician LIKE ?';
        queryParams.push(`%${params.technician}%`);
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
      const stmt = db.prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?');
      stmt.run(status, now, id, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static updateReworkCount(id) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const stmt = db.prepare('UPDATE batches SET rework_count = rework_count + 1, updated_at = ? WHERE id = ?');
      stmt.run(now, id, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static _mapRow(row) {
    return {
      id: row.id,
      prescriptionId: row.prescription_id,
      batchNumber: row.batch_number,
      modelNumber: row.model_number,
      technician: row.technician,
      expectedFinishDate: row.expected_finish_date,
      notes: row.notes,
      status: row.status,
      reworkCount: row.rework_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Batch;
