const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

class ExceptionService {
  static async logException(requestType, requestData, errorType, errorMessage, handlingResult, handledBy = 'system') {
    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const sql = `
        INSERT INTO exception_logs (id, request_type, request_data, error_type, error_message, handling_result, handled_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(sql, [id, requestType, JSON.stringify(requestData), errorType, errorMessage, handlingResult, handledBy], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...requestData });
        }
      });
    });
  }

  static async getAllExceptions() {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM exception_logs ORDER BY created_at DESC`;
      db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            request_data: JSON.parse(row.request_data)
          })));
        }
      });
    });
  }

  static async getExceptionById(id) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM exception_logs WHERE id = ?`;
      db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            request_data: JSON.parse(row.request_data)
          });
        } else {
          resolve(null);
        }
      });
    });
  }
}

module.exports = ExceptionService;
