const db = require('../database');

class LogService {
  async log(operationType, status, reason, options = {}) {
    const logId = db.generateId();
    const now = db.now();

    await db.run(
      `INSERT INTO operation_logs (
        id, operation_type, batch_id, order_id, order_item_id, 
        compensation_id, coupon_id, status, reason, operator, details, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logId,
        operationType,
        options.batchId || null,
        options.orderId || null,
        options.orderItemId || null,
        options.compensationId || null,
        options.couponId || null,
        status,
        reason,
        options.operator || 'system',
        options.details ? JSON.stringify(options.details) : null,
        now
      ]
    );

    return logId;
  }

  async getLogsByOrder(orderId) {
    return await db.all(
      'SELECT * FROM operation_logs WHERE order_id = ? ORDER BY created_at DESC',
      [orderId]
    );
  }

  async getLogsByBatch(batchId) {
    return await db.all(
      'SELECT * FROM operation_logs WHERE batch_id = ? ORDER BY created_at DESC',
      [batchId]
    );
  }
}

module.exports = new LogService();
