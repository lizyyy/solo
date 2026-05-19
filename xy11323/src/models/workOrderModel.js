const db = require('../config/database');

const WorkOrderModel = {
  create: (data, callback) => {
    const { batch_id, row_number, order_no, machine_no, operator_name, work_date, work_type, hours, acres, fuel_cost, total_amount } = data;
    db.run(
      `INSERT INTO work_orders (batch_id, row_number, order_no, machine_no, operator_name, work_date, work_type, hours, acres, fuel_cost, total_amount) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batch_id, row_number, order_no, machine_no, operator_name, work_date, work_type, hours, acres, fuel_cost, total_amount],
      function(err) {
        callback(err, this.lastID);
      }
    );
  },

  getAll: (callback) => {
    db.all('SELECT * FROM work_orders ORDER BY created_at DESC', callback);
  },

  getByBatchId: (batch_id, callback) => {
    db.all('SELECT * FROM work_orders WHERE batch_id = ? ORDER BY row_number', [batch_id], callback);
  },

  getById: (id, callback) => {
    db.get('SELECT * FROM work_orders WHERE id = ?', [id], callback);
  },

  update: (id, data, callback) => {
    const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    db.run(`UPDATE work_orders SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values, callback);
  },

  updateStatus: (id, status, callback) => {
    db.run('UPDATE work_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id], callback);
  },

  delete: (id, callback) => {
    db.run('DELETE FROM work_orders WHERE id = ?', [id], callback);
  }
};

module.exports = WorkOrderModel;