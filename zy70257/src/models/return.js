const db = require('../config/database');
const { RETURN_STATUS, RETURN_STATUS_LABELS, RETURN_REASON_LABELS, DEPARTMENT_LABELS } = require('../utils/enums');
const { v4: uuidv4 } = require('uuid');

class Return {
  static create(returnData) {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const { prescriptionId, batchId, reason, reasonDetail, returnedBy, notes } = returnData;
      const now = Date.now();
      
      const stmt = db.prepare(`
        INSERT INTO returns (
          id, prescription_id, batch_id, reason, reason_detail,
          returned_by, notes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id, prescriptionId, batchId, reason, reasonDetail,
        returnedBy, notes, RETURN_STATUS.SUBMITTED, now, now,
        function(err) {
          if (err) return reject(err);
          resolve({
            id,
            prescriptionId,
            batchId,
            reason,
            reasonLabel: RETURN_REASON_LABELS[reason],
            reasonDetail,
            returnedBy,
            notes,
            status: RETURN_STATUS.SUBMITTED,
            statusLabel: RETURN_STATUS_LABELS[RETURN_STATUS.SUBMITTED],
            createdAt: now,
            updatedAt: now
          });
        }
      );
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM returns WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        resolve(row ? this._mapRow(row) : null);
      });
    });
  }

  static findByPrescriptionId(prescriptionId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM returns WHERE prescription_id = ? ORDER BY created_at DESC', [prescriptionId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static findByBatchId(batchId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM returns WHERE batch_id = ? ORDER BY created_at DESC', [batchId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static findAll(params = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM returns WHERE 1=1';
      const queryParams = [];
      
      if (params.status) {
        sql += ' AND status = ?';
        queryParams.push(params.status);
      }
      if (params.reason) {
        sql += ' AND reason = ?';
        queryParams.push(params.reason);
      }
      
      sql += ' ORDER BY created_at DESC';
      
      db.all(sql, queryParams, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(row => this._mapRow(row)));
      });
    });
  }

  static updateStatus(id, status, resolvedBy = null, resolutionNotes = null) {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const params = [status, now, id];
      let sql = 'UPDATE returns SET status = ?, updated_at = ?';
      
      if (resolvedBy) {
        sql += ', resolved_by = ?';
        params.splice(2, 0, resolvedBy);
      }
      if (resolutionNotes) {
        sql += ', resolution_notes = ?';
        params.splice(3, 0, resolutionNotes);
      }
      if (status === RETURN_STATUS.RESOLVED) {
        sql += ', resolved_at = ?';
        params.splice(3, 0, now);
      }
      
      sql += ' WHERE id = ?';
      
      const stmt = db.prepare(sql);
      stmt.run(...params, function(err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });
  }

  static async findWithDetails(id) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          r.*,
          p.doctor_name, p.patient_name, p.clinic,
          b.batch_number, b.model_number, b.technician as batch_technician
        FROM returns r
        LEFT JOIN prescriptions p ON r.prescription_id = p.id
        LEFT JOIN batches b ON r.batch_id = b.id
        WHERE r.id = ?
      `, [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        
        const result = this._mapRow(row);
        result.prescription = {
          doctorName: row.doctor_name,
          patientName: row.patient_name,
          clinic: row.clinic
        };
        result.batch = {
          batchNumber: row.batch_number,
          modelNumber: row.model_number,
          technician: row.batch_technician
        };
        
        resolve(result);
      });
    });
  }

  static _mapRow(row) {
    return {
      id: row.id,
      prescriptionId: row.prescription_id,
      batchId: row.batch_id,
      reason: row.reason,
      reasonLabel: RETURN_REASON_LABELS[row.reason],
      reasonDetail: row.reason_detail,
      returnedBy: row.returned_by,
      notes: row.notes,
      status: row.status,
      statusLabel: RETURN_STATUS_LABELS[row.status],
      resolvedBy: row.resolved_by,
      resolutionNotes: row.resolution_notes,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = Return;
