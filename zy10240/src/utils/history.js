const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class HistoryService {
  static async record(operationType, recordId, recordType, action, operatedBy, oldData = null, newData = null, requestId = null) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO operation_history 
         (id, operation_type, record_id, record_type, action, old_data, new_data, operated_by, request_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          operationType,
          recordId,
          recordType,
          action,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          operatedBy,
          requestId
        ],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static async getHistory(recordId, recordType) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM operation_history WHERE record_id = ? AND record_type = ? ORDER BY operated_at DESC',
        [recordId, recordType],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            old_data: row.old_data ? JSON.parse(row.old_data) : null,
            new_data: row.new_data ? JSON.parse(row.new_data) : null
          })));
        }
      );
    });
  }

  static async getHistoryByType(recordType, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM operation_history WHERE record_type = ? ORDER BY operated_at DESC LIMIT ?',
        [recordType, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            ...row,
            old_data: row.old_data ? JSON.parse(row.old_data) : null,
            new_data: row.new_data ? JSON.parse(row.new_data) : null
          })));
        }
      );
    });
  }
}

module.exports = HistoryService;
