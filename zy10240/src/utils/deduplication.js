const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class DeduplicationService {
  static async checkDuplicate(requestId, operationType) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM request_deduplication WHERE request_id = ? AND operation_type = ?',
        [requestId, operationType],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row : null);
        }
      );
    });
  }

  static async recordRequest(requestId, operationType, recordId = null) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO request_deduplication (id, request_id, operation_type, record_id) VALUES (?, ?, ?, ?)',
        [uuidv4(), requestId, operationType, recordId],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  static async ensureUnique(requestId, operationType, callback) {
    const existing = await this.checkDuplicate(requestId, operationType);
    if (existing) {
      return {
        isDuplicate: true,
        existingRecord: existing,
        data: null
      };
    }

    const result = await callback();
    await this.recordRequest(requestId, operationType, result?.id);
    
    return {
      isDuplicate: false,
      existingRecord: null,
      data: result
    };
  }
}

module.exports = DeduplicationService;
