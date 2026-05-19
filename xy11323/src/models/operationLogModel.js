const db = require('../config/database');

const OperationLogModel = {
  create: (data, callback) => {
    const { operation_type, batch_id, record_id, record_type, old_data, new_data, operator } = data;
    db.run(
      `INSERT INTO operation_logs (operation_type, batch_id, record_id, record_type, old_data, new_data, operator) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [operation_type, batch_id, record_id, record_type, old_data ? JSON.stringify(old_data) : null, new_data ? JSON.stringify(new_data) : null, operator],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM operation_logs ORDER BY operation_time DESC', callback);
  },

  getByRecord: (record_type, record_id, callback) => {
    db.all('SELECT * FROM operation_logs WHERE record_type = ? AND record_id = ? ORDER BY operation_time DESC', [record_type, record_id], callback);
  },

  getByBatchId: (batch_id, callback) => {
    db.all('SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY operation_time DESC', [batch_id], callback);
  }
};

module.exports = OperationLogModel;