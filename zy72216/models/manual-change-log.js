const db = require('./db');

function createLog(log, callback) {
  const sql = `
    INSERT INTO manual_change_logs (
      record_id, field_name, old_value, new_value,
      change_reason, operator, operate_time, evidence_screenshot
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    log.record_id,
    log.field_name,
    log.old_value,
    log.new_value,
    log.change_reason,
    log.operator,
    log.operate_time,
    log.evidence_screenshot || null
  ];
  db.run(sql, params, function(err) {
    callback(err, err ? null : this.lastID);
  });
}

function getLogsByRecordId(recordId, callback) {
  const sql = `SELECT * FROM manual_change_logs WHERE record_id = ? ORDER BY operate_time DESC`;
  db.all(sql, [recordId], callback);
}

function getAllLogs(callback) {
  const sql = `SELECT * FROM manual_change_logs ORDER BY operate_time DESC`;
  db.all(sql, [], callback);
}

module.exports = {
  createLog,
  getLogsByRecordId,
  getAllLogs
};
