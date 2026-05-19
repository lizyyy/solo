const db = require('../models/database');

function logOperation(data) {
  return new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO operation_logs 
      (record_id, batch_id, operation_type, operation_status, reason, handled_by, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.record_id || null,
      data.batch_id || null,
      data.operation_type,
      data.operation_status,
      data.reason || null,
      data.handled_by,
      data.details ? JSON.stringify(data.details) : null
    ], function(err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, ...data });
    });
  });
}

function getRecordLogs(recordId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM operation_logs 
      WHERE record_id = ? 
      ORDER BY handled_at DESC
    `, [recordId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      })));
    });
  });
}

function getBatchLogs(batchId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT * FROM operation_logs 
      WHERE batch_id = ? 
      ORDER BY handled_at DESC
    `, [batchId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map(row => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : null
      })));
    });
  });
}

module.exports = {
  logOperation,
  getRecordLogs,
  getBatchLogs
};
