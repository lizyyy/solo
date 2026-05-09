const { v4: uuidv4 } = require('uuid');
const db = require('./database');

function generateId() {
  return uuidv4();
}

function responseSuccess(data, message = 'success') {
  return {
    success: true,
    message,
    data
  };
}

function responseError(message, code = 400, details = null) {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  };
}

function recordHistory(recordType, recordId, action, beforeData, afterData, operator = 'system') {
  return new Promise((resolve, reject) => {
    const id = generateId();
    db.run(
      `INSERT INTO history (id, record_type, record_id, action, before_data, after_data, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, recordType, recordId, action, JSON.stringify(beforeData), JSON.stringify(afterData), operator],
      (err) => {
        if (err) reject(err);
        else resolve(id);
      }
    );
  });
}

function getHistory(recordType, recordId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM history WHERE record_type = ? AND record_id = ? ORDER BY created_at ASC`,
      [recordType, recordId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          before_data: row.before_data ? JSON.parse(row.before_data) : null,
          after_data: row.after_data ? JSON.parse(row.after_data) : null
        })));
      }
    );
  });
}

function validateRequiredFields(data, requiredFields) {
  const missing = [];
  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }
  return missing;
}

module.exports = {
  generateId,
  responseSuccess,
  responseError,
  recordHistory,
  getHistory,
  validateRequiredFields
};
