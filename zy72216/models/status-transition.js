const db = require('./db');

function createTransition(transition, callback) {
  const sql = `
    INSERT INTO status_transitions (
      record_id, from_status, to_status,
      transition_reason, operator, operate_time
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [
    transition.record_id,
    transition.from_status,
    transition.to_status,
    transition.transition_reason,
    transition.operator,
    transition.operate_time
  ];
  db.run(sql, params, function(err) {
    callback(err, err ? null : this.lastID);
  });
}

function getTransitionsByRecordId(recordId, callback) {
  const sql = `SELECT * FROM status_transitions WHERE record_id = ? ORDER BY operate_time DESC`;
  db.all(sql, [recordId], callback);
}

function getAllTransitions(callback) {
  const sql = `SELECT * FROM status_transitions ORDER BY operate_time DESC`;
  db.all(sql, [], callback);
}

module.exports = {
  createTransition,
  getTransitionsByRecordId,
  getAllTransitions
};
