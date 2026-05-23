const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const logException = async (operationType, rawInput, errorMessage, errorCode, processingResult, relatedRecordId, relatedRecordType, operator) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO exception_logs (
        id, operation_type, raw_input, error_message, error_code,
        processing_result, related_record_id, related_record_type, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      uuidv4(),
      operationType,
      JSON.stringify(rawInput),
      errorMessage,
      errorCode,
      processingResult,
      relatedRecordId,
      relatedRecordType,
      operator
    ];
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, ...params });
    });
  });
};

const getExceptions = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = 'SELECT * FROM exception_logs WHERE 1=1';
    const params = [];
    if (filters.related_record_id) {
      sql += ' AND related_record_id = ?';
      params.push(filters.related_record_id);
    }
    if (filters.operation_type) {
      sql += ' AND operation_type = ?';
      params.push(filters.operation_type);
    }
    sql += ' ORDER BY created_at DESC';
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  logException,
  getExceptions
};
