const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pet_medication.db');

async function logException(req, status, message, originalInput = null, errors = null) {
  return new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath);
    const requestId = req.headers['x-request-id'] || uuidv4();
    
    const input = originalInput || JSON.stringify({
      body: req.body,
      params: req.params,
      query: req.query
    });

    const processingResult = message + (errors ? ' | ' + JSON.stringify(errors) : '');

    db.run(`
      INSERT INTO exception_logs (id, request_id, endpoint, method, original_input, error_message, processing_result, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      requestId,
      req.originalUrl || req.path,
      req.method,
      input,
      message,
      processingResult,
      status
    ], (err) => {
      db.close();
      if (err) {
        console.error('记录异常日志失败:', err.message);
      }
      resolve(requestId);
    });
  });
}

module.exports = { logException };
