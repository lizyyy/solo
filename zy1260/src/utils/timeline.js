const db = require('../config/database');

const TimelineManager = {
  record: (transactionId, step, status, message = null) => {
    db.prepare(`
      INSERT INTO transaction_timeline (transaction_id, step, status, message, timestamp)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(transactionId, step, status, message);
  },

  getTimeline: (transactionId) => {
    return db.prepare(`
      SELECT * FROM transaction_timeline 
      WHERE transaction_id = ? 
      ORDER BY timestamp ASC
    `).all(transactionId);
  },

  getTimelineWithDetails: (transactionId) => {
    const timeline = this.getTimeline(transactionId);
    const transaction = db.prepare(`
      SELECT * FROM transactions WHERE id = ?
    `).get(transactionId);

    if (!transaction) {
      return null;
    }

    let payload;
    try {
      payload = JSON.parse(transaction.payload);
    } catch (e) {
      payload = {};
    }

    return {
      transactionId: transaction.id,
      businessType: transaction.business_type,
      status: transaction.status,
      idempotencyKey: transaction.idempotency_key,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      payload,
      timeline: timeline.map(t => ({
        id: t.id,
        step: t.step,
        status: t.status,
        message: t.message,
        timestamp: t.timestamp
      }))
    };
  },

  listAllTransactions: () => {
    return db.prepare(`
      SELECT id, business_type, status, created_at, updated_at
      FROM transactions 
      ORDER BY created_at DESC
    `).all();
  }
};

module.exports = TimelineManager;
