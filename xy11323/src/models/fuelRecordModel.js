const db = require('../config/database');

const FuelRecordModel = {
  create: (data, callback) => {
    const { batch_id, row_number, record_no, machine_no, fuel_date, fuel_type, liters, price_per_liter, total_cost } = data;
    db.run(
      `INSERT INTO fuel_records (batch_id, row_number, record_no, machine_no, fuel_date, fuel_type, liters, price_per_liter, total_cost) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, row_number, record_no, machine_no, fuel_date, fuel_type, liters, price_per_liter, total_cost],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM fuel_records ORDER BY created_at DESC', callback);
  },

  getByBatchId: (batch_id, callback) => {
    db.all('SELECT * FROM fuel_records WHERE batch_id = ? ORDER BY row_number', [batch_id], callback);
  },

  getById: (id, callback) => {
    db.get('SELECT * FROM fuel_records WHERE id = ?', [id], callback);
  },

  update: (id, data, callback) => {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    db.run(`UPDATE fuel_records SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, callback);
  },

  updateStatus: (id, status, callback) => {
    db.run('UPDATE fuel_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], callback);
  },

  delete: (id, callback) => {
    db.run('DELETE FROM fuel_records WHERE id = ?', [id], callback);
  }
};

module.exports = FuelRecordModel;