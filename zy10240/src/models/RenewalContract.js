const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { RENEWAL_STATUSES } = require('../utils/constants');

class RenewalContract {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO renewal_contracts 
         (id, customer_id, location_id, start_date, end_date, status, total_amount, notes, created_by, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.customer_id,
          data.location_id,
          data.start_date,
          data.end_date,
          data.status || RENEWAL_STATUSES.PENDING,
          data.total_amount || 0,
          data.notes,
          data.created_by,
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
      db.get('SELECT * FROM renewal_contracts WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByCustomer(customerId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM renewal_contracts WHERE customer_id = ? ORDER BY start_date DESC',
        [customerId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async confirm(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE renewal_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [RENEWAL_STATUSES.CONFIRMED, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: RENEWAL_STATUSES.CONFIRMED });
        }
      );
    });
  }

  static async cancel(id, reason, operatedBy) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE renewal_contracts 
         SET status = ?, notes = COALESCE(notes || '; ', '') || ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [RENEWAL_STATUSES.CANCELLED, `取消原因: ${reason} (操作人: ${operatedBy})`, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: RENEWAL_STATUSES.CANCELLED });
        }
      );
    });
  }

  static async markBilled(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE renewal_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [RENEWAL_STATUSES.BILLED, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: RENEWAL_STATUSES.BILLED });
        }
      );
    });
  }

  static async getAll(status = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM renewal_contracts';
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

module.exports = RenewalContract;
