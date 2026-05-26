const db = require('../config/database');

class DepositRuleModel {
  static create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO deposit_rules 
        (device_type, device_model, deposit_amount, overdue_rate)
        VALUES (?, ?, ?, ?)
      `;
      const params = [
        data.device_type, data.device_model, 
        data.deposit_amount, data.overdue_rate
      ];
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  static findByDeviceType(deviceType) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM deposit_rules WHERE device_type = ? AND is_active = 1', [deviceType], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static findAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM deposit_rules WHERE is_active = 1 ORDER BY created_at DESC', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = DepositRuleModel;
