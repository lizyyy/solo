const db = require('../config/database');

class OperationLog {
  static create(data) {
    return new Promise((resolve, reject) => {
      const { operation_type, module, record_id, operator_name, old_value, new_value, description, ip_address } = data;
      const sql = `INSERT INTO operation_logs 
        (operation_type, module, record_id, operator_name, old_value, new_value, description, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [operation_type, module, record_id, operator_name, old_value, new_value, description, ip_address], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, ...data });
      });
    });
  }

  static findAll(filters = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM operation_logs WHERE 1=1';
      const params = [];

      if (filters.module) {
        sql += ' AND module = ?';
        params.push(filters.module);
      }
      if (filters.operation_type) {
        sql += ' AND operation_type = ?';
        params.push(filters.operation_type);
      }
      if (filters.operator_name) {
        sql += ' AND operator_name LIKE ?';
        params.push(`%${filters.operator_name}%`);
      }
      if (filters.start_date) {
        sql += ' AND created_at >= ?';
        params.push(filters.start_date);
      }
      if (filters.end_date) {
        sql += ' AND created_at <= ?';
        params.push(filters.end_date);
      }

      sql += ' ORDER BY created_at DESC LIMIT 100';

      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static log(operation_type, module, record_id, operator_name, description, old_value = null, new_value = null, ip_address = null) {
    return this.create({
      operation_type,
      module,
      record_id,
      operator_name,
      old_value: old_value ? JSON.stringify(old_value) : null,
      new_value: new_value ? JSON.stringify(new_value) : null,
      description,
      ip_address
    });
  }
}

module.exports = OperationLog;