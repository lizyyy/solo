const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { BILL_STATUSES } = require('../utils/constants');

class RenewalBill {
  static async create(data, requestId) {
    const id = uuidv4();
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO renewal_bills 
         (id, renewal_contract_id, customer_id, bill_date, due_date, plant_details, 
          rental_amount, compensation_amount, total_amount, status, notes, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.renewal_contract_id,
          data.customer_id,
          data.bill_date,
          data.due_date,
          data.plant_details,
          data.rental_amount || 0,
          data.compensation_amount || 0,
          data.total_amount || 0,
          data.status || BILL_STATUSES.DRAFT,
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
      db.get('SELECT * FROM renewal_bills WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async getByCustomer(customerId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM renewal_bills WHERE customer_id = ? ORDER BY bill_date DESC',
        [customerId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async issue(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE renewal_bills SET status = ? WHERE id = ?',
        [BILL_STATUSES.ISSUED, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: BILL_STATUSES.ISSUED });
        }
      );
    });
  }

  static async markPaid(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE renewal_bills SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?',
        [BILL_STATUSES.PAID, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: BILL_STATUSES.PAID });
        }
      );
    });
  }

  static async markOverdue(id) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE renewal_bills SET status = ? WHERE id = ?',
        [BILL_STATUSES.OVERDUE, id],
        function(err) {
          if (err) reject(err);
          else resolve({ id, status: BILL_STATUSES.OVERDUE });
        }
      );
    });
  }

  static async getAll(status = null) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM renewal_bills';
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

module.exports = RenewalBill;
