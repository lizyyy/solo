const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class OperationLogService {
  static async log(requestId, hazardId, operationType, operator, beforeData, afterData, result, reason) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO operation_logs 
         (id, hazard_id, operation_type, operator, before_data, after_data, result, reason, request_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          hazardId,
          operationType,
          operator,
          beforeData ? JSON.stringify(beforeData) : null,
          afterData ? JSON.stringify(afterData) : null,
          result,
          reason,
          requestId
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  static async getLogs(hazardId = null, limit = 100) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM operation_logs`;
      let params = [];
      
      if (hazardId) {
        query += ` WHERE hazard_id = ?`;
        params.push(hazardId);
      }
      
      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);
      
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({
          ...row,
          before_data: row.before_data ? JSON.parse(row.before_data) : null,
          after_data: row.after_data ? JSON.parse(row.after_data) : null
        })));
      });
    });
  }

  static async getTimeline(hazardId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          id, 
          operation_type,
          operator,
          result,
          reason,
          created_at as time
         FROM operation_logs 
         WHERE hazard_id = ? 
         ORDER BY created_at ASC`,
        [hazardId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = OperationLogService;