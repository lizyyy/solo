const db = require('../database');

class BatchService {
  generateBatchNo() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-T:.]/g, '').slice(0, 14);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BATCH-${timestamp}-${random}`;
  }

  async createBatchOperation(operationType, totalCount, createdBy = 'system') {
    const batchNo = this.generateBatchNo();
    
    const result = await db.run(`
      INSERT INTO batch_operations 
      (batch_no, operation_type, total_count, success_count, fail_count, status, created_by)
      VALUES (?, ?, ?, 0, 0, 'processing', ?)
    `, [batchNo, operationType, totalCount, createdBy]);

    return {
      batchId: result.lastID,
      batchNo
    };
  }

  async addBatchItem(batchId, itemIndex, itemKey = null) {
    await db.run(`
      INSERT INTO batch_operation_items 
      (batch_operation_id, item_index, item_key, status)
      VALUES (?, ?, ?, 'pending')
    `, [batchId, itemIndex, itemKey]);
  }

  async updateBatchItemStatus(batchId, itemIndex, status, errorMessage = null, resultData = null) {
    await db.run(`
      UPDATE batch_operation_items 
      SET status = ?, error_message = ?, result_data = ?
      WHERE batch_operation_id = ? AND item_index = ?
    `, [status, errorMessage, resultData ? JSON.stringify(resultData) : null, batchId, itemIndex]);
  }

  async updateBatchSummary(batchId) {
    const result = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'fail' THEN 1 ELSE 0 END) as fail
      FROM batch_operation_items
      WHERE batch_operation_id = ?
    `, [batchId]);

    const successCount = result.success || 0;
    const failCount = result.fail || 0;
    const totalCount = result.total || 0;
    const status = successCount + failCount >= totalCount ? 'completed' : 'processing';

    await db.run(`
      UPDATE batch_operations 
      SET success_count = ?, fail_count = ?, status = ?, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [successCount, failCount, status, batchId]);

    return { successCount, failCount, totalCount, status };
  }

  async getBatchOperation(batchNo) {
    const batch = await db.get(`
      SELECT * FROM batch_operations WHERE batch_no = ?
    `, [batchNo]);

    if (!batch) return null;

    const items = await db.all(`
      SELECT * FROM batch_operation_items 
      WHERE batch_operation_id = ?
      ORDER BY item_index
    `, [batch.id]);

    return {
      ...batch,
      items: items.map(item => ({
        ...item,
        result_data: item.result_data ? JSON.parse(item.result_data) : null
      }))
    };
  }

  async getFailedItems(batchId) {
    return await db.all(`
      SELECT * FROM batch_operation_items 
      WHERE batch_operation_id = ? AND status = 'fail'
      ORDER BY item_index
    `, [batchId]);
  }

  async retryFailedItems(batchId, processItemFn) {
    const failedItems = await this.getFailedItems(batchId);
    
    if (failedItems.length === 0) {
      return { success: 0, failed: 0, message: '没有需要重试的失败项目' };
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of failedItems) {
      try {
        const result = await processItemFn(item);
        await this.updateBatchItemStatus(batchId, item.item_index, 'success', null, result);
        successCount++;
      } catch (error) {
        await this.updateBatchItemStatus(batchId, item.item_index, 'fail', error.message, null);
        failCount++;
      }
    }

    await this.updateBatchSummary(batchId);

    return { successCount, failCount, totalRetried: failedItems.length };
  }

  async executeBatch(items, operationType, processItemFn, createdBy = 'system') {
    const { batchId, batchNo } = await this.createBatchOperation(operationType, items.length, createdBy);

    for (let i = 0; i < items.length; i++) {
      await this.addBatchItem(batchId, i, items[i].key || null);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      try {
        const result = await processItemFn(items[i], i);
        await this.updateBatchItemStatus(batchId, i, 'success', null, result);
        successCount++;
      } catch (error) {
        await this.updateBatchItemStatus(batchId, i, 'fail', error.message, null);
        failCount++;
      }
    }

    await this.updateBatchSummary(batchId);

    return {
      batchNo,
      batchId,
      totalCount: items.length,
      successCount,
      failCount
    };
  }

  async getBatchHistory(limit = 20) {
    return await db.all(`
      SELECT * FROM batch_operations 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [limit]);
  }
}

module.exports = new BatchService();
