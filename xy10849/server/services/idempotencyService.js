const db = require('../db');
const { v4: uuidv4 } = require('uuid');

class IdempotencyService {
  static async checkIdempotency(key, requestType) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM idempotency_keys WHERE key = ? AND request_type = ?',
        [key, requestType],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? JSON.parse(row.response_data) : null);
        }
      );
    });
  }

  static async saveIdempotency(key, requestType, responseData) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO idempotency_keys (id, key, request_type, response_data) VALUES (?, ?, ?, ?)',
        [uuidv4(), key, requestType, JSON.stringify(responseData)],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}

module.exports = IdempotencyService;
