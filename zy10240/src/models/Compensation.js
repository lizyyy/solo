const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { COMPENSATION_STATUSES } = require('../utils/constants');

class Compensation {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO compensations 
         (id, plant_id, location_id, withering_treatment_id, amount, reason, status, handled_by, notes, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.plant_id,
          data.location_id,
          data.withering_treatment_id,
          data.amount,
          data.reason,
          data.status || COMPENSATION_STATUSES.PENDING,
          data.handled_by,
          data.notes,
          requestId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id, ...data });
        }
      );
    });
  }

  static async getById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM compensations WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByPlant(plantId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM compensations WHERE plant_id = ? ORDER BY created_at DESC',
        [plantId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async approve(id, approvedBy, notes = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE compensations 
         SET status = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP, notes = COALESCE(notes || '; ', '') || ?
         WHERE id = ?`,
        [COMPENSATION_STATUSES.APPROVED, approvedBy, notes ? `审批备注: ${notes}` : '', id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: COMPENSATION_STATUSES.APPROVED });
        }
      );
    });
  }

  static async markPaid(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE compensations SET status = ? WHERE id = ?',
        [COMPENSATION_STATUSES.PAID, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: COMPENSATION_STATUSES.PAID });
        }
      );
    });
  }

  static async waive(id, reason, operatedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE compensations 
         SET status = ?, notes = COALESCE(notes || '; ', '') || ?
         WHERE id = ?`,
        [COMPENSATION_STATUSES.WAIVED, `豁免原因: ${reason} (操作人: ${operatedBy})`, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: COMPENSATION_STATUSES.WAIVED });
        }
      );
    });
  }

  static async getAll(status = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM compensations';
      let params = [];
      
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = Compensation;
