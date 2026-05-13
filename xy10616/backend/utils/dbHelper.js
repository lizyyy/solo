const db = require('../config/database');

class DbHelper {
  static run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  static get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async saveFlowRecord(businessType, businessId, action, oldValue, newValue, operator, remarks = '') {
    const sql = `INSERT INTO flow_records 
      (business_type, business_id, action, old_value, new_value, operator, remarks) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    return this.run(sql, [
      businessType,
      businessId,
      action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      operator,
      remarks
    ]);
  }

  static async checkDuplicateTransaction(transactionNo) {
    const sql = 'SELECT id FROM renewal_payments WHERE transaction_no = ?';
    const result = await this.get(sql, [transactionNo]);
    return !!result;
  }

  static async checkBlacklist(plateNumber) {
    const sql = 'SELECT id FROM blacklist WHERE plate_number = ? AND status = ?';
    const result = await this.get(sql, [plateNumber, 'active']);
    return !!result;
  }
}

module.exports = DbHelper;
