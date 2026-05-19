const db = require('../config/database');

const BatchModel = {
  create: (file_name, file_type, callback) => {
    db.run(
      'INSERT INTO import_batches (file_name, file_type) VALUES (?, ?)',
      [file_name, file_type],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  updateStats: (batch_id, total, success, error, callback) => {
    db.run(
      'UPDATE import_batches SET total_records = ?, success_count = ?, error_count = ? WHERE id = ?',
      [total, success, error, batch_id],
      callback
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM import_batches ORDER BY import_time DESC', callback);
  },

  getById: (id, callback) => {
    db.get('SELECT * FROM import_batches WHERE id = ?', [id], callback);
  }
};

module.exports = BatchModel;