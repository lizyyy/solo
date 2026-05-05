const db = require('../config/database');

const RetryManager = {
  recordRetry: (transactionId, step, attemptCount, status) => {
    db.prepare(`
      INSERT INTO retry_attempts (transaction_id, step, attempt_count, status)
      VALUES (?, ?, ?, ?)
    `).run(transactionId, step, attemptCount, status);
  },

  getRetryCount: (transactionId, step) => {
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM retry_attempts 
      WHERE transaction_id = ? AND step = ?
    `).get(transactionId, step);
    return result ? result.count : 0;
  },

  getRetryHistory: (transactionId) => {
    return db.prepare(`
      SELECT * FROM retry_attempts 
      WHERE transaction_id = ? 
      ORDER BY created_at ASC
    `).all(transactionId);
  },

  canRetry: (transactionId, step, maxAttempts = 3) => {
    const count = this.getRetryCount(transactionId, step);
    return count < maxAttempts;
  }
};

module.exports = RetryManager;
