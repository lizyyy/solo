const db = require('../config/database');

const ErrorRecordModel = {
  create: (data, callback) => {
    const { batch_id, file_type, row_number, original_data, error_type, error_message, suggestion } = data;
    db.run(
      `INSERT INTO error_records (batch_id, file_type, row_number, original_data, error_type, error_message, suggestion) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, file_type, row_number, JSON.stringify(original_data), error_type, error_message, suggestion],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM error_records ORDER BY created_at DESC', callback);
  },

  getByBatchId: (batch_id, callback) => {
    db.all('SELECT * FROM error_records WHERE batch_id = ? ORDER BY row_number', [batch_id], callback);
  },

  getById: (id, callback) => {
    db.get('SELECT * FROM error_records WHERE id = ?', [id], callback);
  },

  getUnfixed: (callback) => {
    db.all('SELECT * FROM error_records WHERE is_fixed = 0 ORDER BY created_at DESC', callback);
  },

  markAsFixed: (id, corrected_data, callback) => {
    db.run(
      'UPDATE error_records SET is_fixed = 1, corrected_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(corrected_data), id],
      callback
    );
  },

  delete: (id, callback) => {
    db.run('DELETE FROM error_records WHERE id = ?', [id], callback);
  }
};

module.exports = ErrorRecordModel;