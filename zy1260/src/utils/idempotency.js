const db = require('../config/database');

const IdempotencyManager = {
  checkAndRecord: (key, transactionId) => {
    const existing = db.prepare(`
      SELECT * FROM idempotency_keys WHERE key = ?
    `).get(key);

    if (existing) {
      const transaction = db.prepare(`
        SELECT * FROM transactions WHERE id = ?
      `).get(existing.transaction_id);
      
      return {
        isDuplicate: true,
        existingTransaction: transaction
      };
    }

    db.prepare(`
      INSERT INTO idempotency_keys (key, transaction_id) VALUES (?, ?)
    `).run(key, transactionId);

    return {
      isDuplicate: false,
      existingTransaction: null
    };
  },

  getTransactionByKey: (key) => {
    const mapping = db.prepare(`
      SELECT * FROM idempotency_keys WHERE key = ?
    `).get(key);

    if (!mapping) {
      return null;
    }

    return db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(mapping.transaction_id);
  },

  listAll: () => {
    return db.prepare('SELECT * FROM idempotency_keys ORDER BY created_at DESC').all();
  }
};

module.exports = IdempotencyManager;
