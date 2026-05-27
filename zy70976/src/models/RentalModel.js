const db = require('../config/database');

class RentalModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO rental_records 
        (batch_id, device_serial, device_name, customer_name, customer_phone, 
         rental_start_date, rental_end_date, actual_return_date, 
         daily_rate, deposit_amount, deposit_flow_id, total_rental_fee, 
         actual_payment, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.batch_id, data.device_serial, data.device_name, 
        data.customer_name, data.customer_phone,
        data.rental_start_date, data.rental_end_date, 
        data.actual_return_date || null,
        data.daily_rate, data.deposit_amount,
        data.deposit_flow_id, data.total_rental_fee, 
        data.actual_payment, data.status || 'pending'
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE rental_records 
        SET actual_return_date = COALESCE(?, actual_return_date),
            total_rental_fee = COALESCE(?, total_rental_fee),
            actual_payment = COALESCE(?, actual_payment),
            status = COALESCE(?, status),
            overdue_days = COALESCE(?, overdue_days),
            overdue_fee = COALESCE(?, overdue_fee),
            repair_fee = COALESCE(?, repair_fee),
            has_repair = COALESCE(?, has_repair),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        data.actual_return_date, data.total_rental_fee,
        data.actual_payment, data.status,
        data.overdue_days, data.overdue_fee,
        data.repair_fee, data.has_repair, id
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  static findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM rental_records WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findByDeviceSerial(serial) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rental_records WHERE device_serial = ? ORDER BY created_at DESC', [serial], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByDepositFlow(flowId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rental_records WHERE deposit_flow_id = ?', [flowId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM rental_records 
        WHERE rental_start_date >= ? AND rental_end_date <= ?
        ORDER BY created_at DESC
      `;
      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByBatch(batchId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rental_records WHERE batch_id = ?', [batchId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM rental_records WHERE 1=1';
      const params = [];

      if (filters.device_serial) {
        sql += ' AND device_serial LIKE ?';
        params.push(`%${filters.device_serial}%`);
      }
      if (filters.customer_name) {
        sql += ' AND customer_name LIKE ?';
        params.push(`%${filters.customer_name}%`);
      }
      if (filters.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
      if (filters.batch_id) {
        sql += ' AND batch_id = ?';
        params.push(filters.batch_id);
      }
      if (filters.rental_start_date) {
        sql += ' AND rental_start_date >= ?';
        params.push(filters.rental_start_date);
      }
      if (filters.rental_end_date) {
        sql += ' AND rental_end_date <= ?';
        params.push(filters.rental_end_date);
      }

      sql += ' ORDER BY created_at DESC';
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RentalModel;
