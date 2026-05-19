const db = require('../config/database');

const RateConfigModel = {
  create: (data, callback) => {
    const { batch_id, row_number, work_type, rate_per_hour, rate_per_acre, fuel_surcharge_rate, effective_date } = data;
    db.run(
      `INSERT INTO rate_configs (batch_id, row_number, work_type, rate_per_hour, rate_per_acre, fuel_surcharge_rate, effective_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, row_number, work_type, rate_per_hour, rate_per_acre, fuel_surcharge_rate, effective_date],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM rate_configs ORDER BY created_at DESC', callback);
  },

  getByBatchId: (batch_id, callback) => {
    db.all('SELECT * FROM rate_configs WHERE batch_id = ? ORDER BY row_number', [batch_id], callback);
  },

  getById: (id, callback) => {
    db.get('SELECT * FROM rate_configs WHERE id = ?', [id], callback);
  },

  getActiveRates: (callback) => {
    db.all('SELECT * FROM rate_configs WHERE status = "active" ORDER BY effective_date DESC', callback);
  },

  update: (id, data, callback) => {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    db.run(`UPDATE rate_configs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, callback);
  },

  delete: (id, callback) => {
    db.run('DELETE FROM rate_configs WHERE id = ?', [id], callback);
  }
};

module.exports = RateConfigModel;