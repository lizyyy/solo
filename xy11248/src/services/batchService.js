const db = require('../database');
const logService = require('./logService');

class BatchService {
  async createBatch(operationType, totalCount) {
    const batchId = db.generateId();
    const batchNo = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const now = db.now();

    await db.run(
      `INSERT INTO batch_operations (
        id, batch_no, operation_type, total_count, success_count, fail_count, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0, 'processing', ?, ?)`,
      [batchId, batchNo, operationType, totalCount, now, now]
    );

    return { batchId, batchNo };
  }

  async addBatchItem(batchId, itemKey, status, reason = null) {
    const itemId = db.generateId();
    const now = db.now();

    await db.run(
      `INSERT INTO batch_operation_items (id, batch_id, item_key, status, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [itemId, batchId, itemKey, status, reason, now]
    );

    return itemId;
  }

  async updateBatchStats(batchId) {
    const stats = await db.get(
      `SELECT 
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'fail' THEN 1 END) as fail_count
       FROM batch_operation_items WHERE batch_id = ?`,
      [batchId]
    );

    await db.run(
      `UPDATE batch_operations 
       SET success_count = ?, fail_count = ?, updated_at = ?
       WHERE id = ?`,
      [stats.success_count || 0, stats.fail_count || 0, db.now(), batchId]
    );

    return stats;
  }

  async completeBatch(batchId) {
    const stats = await this.updateBatchStats(batchId);
    const status = stats.fail_count === 0 ? 'completed' : 'partial';

    await db.run(
      `UPDATE batch_operations SET status = ?, updated_at = ? WHERE id = ?`,
      [status, db.now(), batchId]
    );

    return { ...stats, status };
  }

  async getBatchResult(batchId) {
    const batch = await db.get(
      'SELECT * FROM batch_operations WHERE id = ?',
      [batchId]
    );

    const items = await db.all(
      'SELECT * FROM batch_operation_items WHERE batch_id = ?',
      [batchId]
    );

    return {
      batch,
      successItems: items.filter(i => i.status === 'success'),
      failItems: items.filter(i => i.status === 'fail')
    };
  }

  async checkItemProcessed(operationType, itemKey) {
    const item = await db.get(
      `SELECT bi.*, bo.status as batch_status
       FROM batch_operation_items bi
       JOIN batch_operations bo ON bi.batch_id = bo.id
       WHERE bo.operation_type = ? AND bi.item_key = ? AND bi.status = 'success'
       ORDER BY bi.created_at DESC LIMIT 1`,
      [operationType, itemKey]
    );

    return item !== undefined;
  }
}

module.exports = new BatchService();
