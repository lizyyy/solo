const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

function generateId() {
  return uuidv4();
}

function hashRequest(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

function checkIdempotency(requestHash) {
  return new Promise((resolve, reject) => {
    db.get('SELECT response_data FROM idempotency_keys WHERE request_hash = ?', 
      [requestHash], 
      (err, row) => {
        if (err) reject(err);
        resolve(row ? JSON.parse(row.response_data) : null);
      }
    );
  });
}

function saveIdempotency(requestHash, responseData) {
  return new Promise((resolve, reject) => {
    db.run('INSERT INTO idempotency_keys (id, request_hash, response_data) VALUES (?, ?, ?)',
      [generateId(), requestHash, JSON.stringify(responseData)],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

function recordHistory(operationType, recordId, fieldName, oldValue, newValue, operator, remarks = '') {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO operation_history 
      (id, operation_type, record_id, field_name, old_value, new_value, operator, remarks) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), operationType, recordId, fieldName, 
       String(oldValue), String(newValue), operator, remarks],
      (err) => {
        if (err) reject(err);
        resolve();
      }
    );
  });
}

function validateTemperature(temp, min = -25, max = -15) {
  if (typeof temp !== 'number' || isNaN(temp)) {
    return { valid: false, message: '温度必须是数字' };
  }
  if (temp < min || temp > max) {
    return { 
      valid: false, 
      message: `温度必须在 ${min}°C 到 ${max}°C 之间，当前 ${temp}°C` 
    };
  }
  return { valid: true };
}

function errorResponse(res, message, code = 400) {
  return res.status(code).json({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  });
}

function successResponse(res, data, message = '操作成功') {
  return res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  generateId,
  hashRequest,
  checkIdempotency,
  saveIdempotency,
  recordHistory,
  validateTemperature,
  errorResponse,
  successResponse
};
