const db = require('../config/database');

class IdempotencyDao {
  static get(requestId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM idempotency WHERE request_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)',
        [requestId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  static create(requestId, endpoint, responseData, expiresInHours = 24) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);
    
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO idempotency (request_id, endpoint, response_data, expires_at)
         VALUES (?, ?, ?, ?)`,
        [requestId, endpoint, JSON.stringify(responseData), expiresAt.toISOString()],
        function(err) {
          if (err) reject(err);
          else resolve({ requestId, endpoint });
        }
      );
    });
  }

  static cleanupExpired() {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM idempotency WHERE expires_at < CURRENT_TIMESTAMP',
        function(err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes });
        }
      );
    });
  }
}

module.exports = IdempotencyDao;
