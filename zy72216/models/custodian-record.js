const db = require('./db');
const { STATUS } = require('../utils/constants');

function createRecord(record, callback) {
  const sql = `
    INSERT INTO custodian_records (
      batch_id, original_line_number, fund_code, fund_name,
      security_code, security_name, original_settlement_date,
      current_settlement_date, original_quantity, current_quantity,
      original_amount, current_amount, import_operator, import_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    record.batch_id,
    record.original_line_number,
    record.fund_code,
    record.fund_name,
    record.security_code,
    record.security_name,
    record.original_settlement_date,
    record.current_settlement_date,
    record.original_quantity,
    record.current_quantity,
    record.original_amount,
    record.current_amount,
    record.import_operator,
    record.import_time
  ];
  db.run(sql, params, function(err) {
    callback(err, err ? null : this.lastID);
  });
}

function getRecordById(id, callback) {
  const sql = `SELECT * FROM custodian_records WHERE id = ?`;
  db.get(sql, [id], callback);
}

function getRecordsByBatch(batchId, callback) {
  const sql = `SELECT * FROM custodian_records WHERE batch_id = ? ORDER BY original_line_number`;
  db.all(sql, [batchId], callback);
}

function getAllRecords(callback) {
  const sql = `SELECT * FROM custodian_records ORDER BY created_at DESC, original_line_number`;
  db.all(sql, [], callback);
}

function updateRecord(id, updates, callback) {
  const fields = [];
  const params = [];
  for (const key in updates) {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      params.push(updates[key]);
    }
  }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);
  const sql = `UPDATE custodian_records SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, params, callback);
}

function updateRecordStatus(id, newStatus, callback) {
  const sql = `UPDATE custodian_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.run(sql, [newStatus, id], callback);
}

function markManualChange(id, changeType, callback) {
  const sql = `
    UPDATE custodian_records 
    SET has_manual_change = 1, change_type = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  db.run(sql, [changeType, id], callback);
}

function clearManualChange(id, callback) {
  const sql = `
    UPDATE custodian_records 
    SET has_manual_change = 0, change_type = NULL, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  db.run(sql, [id], callback);
}

function revertRecord(id, targetStatus, callback) {
  const sql = `
    UPDATE custodian_records 
    SET status = ?, has_manual_change = 0, change_type = NULL, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  db.run(sql, [targetStatus, id], callback);
}

module.exports = {
  createRecord,
  getRecordById,
  getRecordsByBatch,
  getAllRecords,
  updateRecord,
  updateRecordStatus,
  markManualChange,
  clearManualChange,
  revertRecord
};
