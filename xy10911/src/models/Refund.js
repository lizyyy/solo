const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const REFUND_STATUS = {
  PENDING: 'pending',
  VERIFYING: 'verifying',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REFUNDING: 'refunding',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

class Refund {
  static async create(data) {
    return new Promise((resolve, reject) => {
      const refundId = uuidv4();
      const {
        machine_id,
        payment_id,
        start_event_id,
        fault_code,
        fault_screenshot,
        applicant_name,
        applicant_phone,
        reason,
        amount,
        raw_input
      } = data;

      db.run(
        `INSERT INTO refund_applications 
         (refund_id, machine_id, payment_id, start_event_id, fault_code, fault_screenshot, 
          applicant_name, applicant_phone, reason, amount, status, raw_input)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [refundId, machine_id, payment_id, start_event_id, fault_code, fault_screenshot,
         applicant_name, applicant_phone, reason, amount, REFUND_STATUS.PENDING, raw_input],
        function(err) {
          if (err) reject(err);
          else resolve({ refund_id: refundId, ...data, status: REFUND_STATUS.PENDING });
        }
      );
    });
  }

  static async findById(refundId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT ra.*, 
                m.location as machine_location,
                p.amount as payment_amount,
                p.pay_time,
                se.success as start_success,
                se.error_code as start_error
         FROM refund_applications ra
         LEFT JOIN machines m ON ra.machine_id = m.machine_id
         LEFT JOIN payments p ON ra.payment_id = p.payment_id
         LEFT JOIN start_events se ON ra.start_event_id = se.event_id
         WHERE ra.refund_id = ?`,
        [refundId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static async findByPaymentId(paymentId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM refund_applications WHERE payment_id = ? ORDER BY created_at DESC`,
        [paymentId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM refund_applications WHERE 1=1`;
      const params = [];

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }
      if (filters.machine_id) {
        query += ` AND machine_id = ?`;
        params.push(filters.machine_id);
      }

      query += ` ORDER BY created_at DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async updateStatus(refundId, status, operator, conclusion, remarks) {
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => {
            db.run(
              `UPDATE refund_applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE refund_id = ?`,
              [status, refundId],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });

          const logId = uuidv4();
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO processing_logs (log_id, refund_id, action, operator, conclusion, remarks)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [logId, refundId, `status_change_to_${status}`, operator, conclusion, remarks],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });

          resolve({ refund_id: refundId, status });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  static async addLog(refundId, action, operator, conclusion, remarks) {
    return new Promise((resolve, reject) => {
      const logId = uuidv4();
      db.run(
        `INSERT INTO processing_logs (log_id, refund_id, action, operator, conclusion, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, refundId, action, operator, conclusion, remarks],
        function(err) {
          if (err) reject(err);
          else resolve({ log_id: logId });
        }
      );
    });
  }

  static async getLogs(refundId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM processing_logs WHERE refund_id = ? ORDER BY created_at DESC`,
        [refundId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async exportAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          ra.refund_id,
          ra.machine_id,
          m.location as machine_location,
          ra.payment_id,
          p.amount as payment_amount,
          p.pay_time,
          ra.fault_code,
          fc.description as fault_description,
          ra.applicant_name,
          ra.applicant_phone,
          ra.reason,
          ra.amount as refund_amount,
          ra.status,
          ra.created_at as apply_time,
          ra.updated_at as last_update
        FROM refund_applications ra
        LEFT JOIN machines m ON ra.machine_id = m.machine_id
        LEFT JOIN payments p ON ra.payment_id = p.payment_id
        LEFT JOIN fault_codes fc ON ra.fault_code = fc.code
        WHERE 1=1
      `;
      const params = [];

      if (filters.status) {
        query += ` AND ra.status = ?`;
        params.push(filters.status);
      }
      if (filters.start_date) {
        query += ` AND ra.created_at >= ?`;
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        query += ` AND ra.created_at <= ?`;
        params.push(filters.end_date);
      }

      query += ` ORDER BY ra.created_at DESC`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = { Refund, REFUND_STATUS };
