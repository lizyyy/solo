const db = require('../config/database');

const Discrepancy = {
  create: (d, callback) => {
    const sql = 'INSERT INTO discrepancies (discrepancy_id, task_id, order_id, discrepancy_type, description, status, result) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [d.discrepancy_id, d.task_id, d.order_id, d.discrepancy_type, d.description, d.status, d.result], callback);
  },
  findById: (id, callback) => {
    db.get('SELECT * FROM discrepancies WHERE discrepancy_id = ?', [id], callback);
  },
  findByTaskId: (taskId, callback) => {
    db.all('SELECT * FROM discrepancies WHERE task_id = ? ORDER BY discrepancy_id DESC', [taskId], callback);
  },
  findByStatus: (status, callback) => {
    db.all('SELECT * FROM discrepancies WHERE status = ? ORDER BY discrepancy_id DESC', [status], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM discrepancies ORDER BY discrepancy_id DESC', callback);
  },
  updateStatus: (id, status, result, callback) => {
    db.run('UPDATE discrepancies SET status = ?, result = ? WHERE discrepancy_id = ?', [status, result, id], callback);
  },
  bulkInsert: (items, callback) => {
    const ph = items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const vals = items.flatMap(x => [x.discrepancy_id, x.task_id, x.order_id, x.discrepancy_type, x.description, x.status, x.result]);
    db.run('INSERT INTO discrepancies (discrepancy_id, task_id, order_id, discrepancy_type, description, status, result) VALUES ' + ph, vals, callback);
  }
};

module.exports = Discrepancy;
