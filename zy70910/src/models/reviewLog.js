const db = require('../config/database');

const ReviewLog = {
  create: (log, callback) => {
    const sql = 'INSERT INTO review_logs (log_id, discrepancy_id, operator, operation_type, previous_status, next_status, remark, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    db.run(sql, [log.log_id, log.discrepancy_id, log.operator, log.operation_type, log.previous_status, log.next_status, log.remark, log.timestamp], callback);
  },
  findById: (id, callback) => {
    db.get('SELECT * FROM review_logs WHERE log_id = ?', [id], callback);
  },
  findByDiscrepancyId: (dId, callback) => {
    db.all('SELECT * FROM review_logs WHERE discrepancy_id = ? ORDER BY timestamp DESC', [dId], callback);
  },
  findByOperator: (op, callback) => {
    db.all('SELECT * FROM review_logs WHERE operator = ? ORDER BY timestamp DESC', [op], callback);
  },
  findAll: (callback) => {
    db.all('SELECT * FROM review_logs ORDER BY timestamp DESC', callback);
  },
  bulkInsert: (logs, callback) => {
    const ph = logs.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const vals = logs.flatMap(l => [l.log_id, l.discrepancy_id, l.operator, l.operation_type, l.previous_status, l.next_status, l.remark, l.timestamp]);
    db.run('INSERT INTO review_logs (log_id, discrepancy_id, operator, operation_type, previous_status, next_status, remark, timestamp) VALUES ' + ph, vals, callback);
  }
};

module.exports = ReviewLog;
