const db = require('../config/database');

class RepairModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO repair_records 
        (rental_id, device_serial, repair_type, repair_description, 
         repair_cost, is_customer_fault, fault_reason, report_date, repair_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.rental_id, data.device_serial, data.repair_type,
        data.repair_description, data.repair_cost,
        data.is_customer_fault, data.fault_reason,
        data.report_date, data.repair_date
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findByDeviceSerial(serial) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM repair_records WHERE device_serial = ?', [serial], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findByRentalId(rentalId) {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM repair_records WHERE rental_id = ?', [rentalId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM repair_records ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = RepairModel;
