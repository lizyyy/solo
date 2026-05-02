const db = require('../config/database');

const AuditLog = {
  create: (logData) => {
    return new Promise((resolve, reject) => {
      const { operation_type, table_name, record_id, operator, old_value, new_value, ip_address, notes } = logData;
      db.run(
        `INSERT INTO audit_logs (operation_type, table_name, record_id, operator, old_value, new_value, ip_address, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [operation_type, table_name, record_id, operator, old_value, new_value, ip_address, notes],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...logData });
          }
        }
      );
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM audit_logs WHERE id = ?`,
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  getAll: () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM audit_logs ORDER BY operation_time DESC`, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },

  getByOperator: (operator) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_logs WHERE operator = ? ORDER BY operation_time DESC`,
        [operator],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  getByTableName: (tableName) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_logs WHERE table_name = ? ORDER BY operation_time DESC`,
        [tableName],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  getByTimeRange: (startTime, endTime) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_logs WHERE operation_time >= ? AND operation_time <= ? ORDER BY operation_time DESC`,
        [startTime, endTime],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  getByOperationType: (operationType) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM audit_logs WHERE operation_type = ? ORDER BY operation_time DESC`,
        [operationType],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
};

module.exports = AuditLog;
