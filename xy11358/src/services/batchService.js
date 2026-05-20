const { db } = require('../models/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class BatchService {
  async createBatchOperation(operationType, items, startedBy) {
    const batchId = uuidv4();
    const now = moment().format();

    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          await new Promise((res, rej) => {
            db.run(
              `INSERT INTO batch_operations (id, operation_type, total_count, started_by, started_at) VALUES (?, ?, ?, ?, ?)`,
              [batchId, operationType, items.length, startedBy, now],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });

          const stmt = db.prepare(
            `INSERT INTO batch_operation_items (id, batch_id, item_identifier, item_data, status) VALUES (?, ?, ?, ?, ?)`
          );

          for (const item of items) {
            const itemId = uuidv4();
            const identifier = item.phone || item.plate_number || item.identifier || itemId;
            await new Promise((res, rej) => {
              stmt.run(
                [itemId, batchId, identifier, JSON.stringify(item), 'pending'],
                (err) => {
                  if (err) rej(err);
                  else res();
                }
              );
            });
          }

          stmt.finalize();
          resolve({ batchId, totalCount: items.length });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async processBatchItem(batchId, itemId, processor) {
    try {
      const item = await this.getBatchItem(itemId);
      if (!item || item.status === 'success') {
        return { skipped: true, reason: 'Item not found or already processed' };
      }

      const itemData = JSON.parse(item.item_data);
      const result = await processor(itemData);

      const now = moment().format();
      const status = result.success ? 'success' : 'failed';
      const errorMsg = result.success ? null : (result.reason || 'Unknown error');

      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE batch_operation_items SET status = ?, error_message = ?, processed_at = ? WHERE id = ?`,
          [status, errorMsg, now, itemId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await this.updateBatchCounts(batchId);

      return {
        itemId,
        identifier: item.item_identifier,
        status,
        success: result.success,
        error: errorMsg,
        result
      };
    } catch (err) {
      const now = moment().format();
      await new Promise((resolve) => {
        db.run(
          `UPDATE batch_operation_items SET status = 'failed', error_message = ?, processed_at = ? WHERE id = ?`,
          [err.message, now, itemId],
          () => resolve()
        );
      });
      await this.updateBatchCounts(batchId);

      return {
        itemId,
        status: 'failed',
        success: false,
        error: err.message
      };
    }
  }

  async getBatchItem(itemId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM batch_operation_items WHERE id = ?`,
        [itemId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async updateBatchCounts(batchId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as success_count FROM batch_operation_items WHERE batch_id = ? AND status = 'success'`,
        [batchId],
        (err, successRow) => {
          if (err) {
            reject(err);
            return;
          }
          db.get(
            `SELECT COUNT(*) as fail_count FROM batch_operation_items WHERE batch_id = ? AND status = 'failed'`,
            [batchId],
            (err, failRow) => {
              if (err) {
                reject(err);
                return;
              }
              db.run(
                `UPDATE batch_operations SET success_count = ?, fail_count = ? WHERE id = ?`,
                [successRow.success_count, failRow.fail_count, batchId],
                (err) => {
                  if (err) reject(err);
                  else resolve({ success: successRow.success_count, failed: failRow.fail_count });
                }
              );
            }
          );
        }
      );
    });
  }

  async completeBatch(batchId, errorSummary = null) {
    const now = moment().format();
    const counts = await this.updateBatchCounts(batchId);
    
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE batch_operations SET status = 'completed', completed_at = ?, error_summary = ? WHERE id = ?`,
        [now, errorSummary, batchId],
        (err) => {
          if (err) reject(err);
          else resolve({ batchId, ...counts, status: 'completed' });
        }
      );
    });
  }

  async processBatch(batchId, processor, options = {}) {
    const { concurrency = 5, retries = 0 } = options;
    const items = await this.getPendingItems(batchId);
    const results = [];

    for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(item => this.processWithRetry(batchId, item.id, processor, retries))
      );
      results.push(...chunkResults);
    }

    const failedItems = results.filter(r => !r.success);
    const errorSummary = failedItems.length > 0 
      ? `${failedItems.length} items failed. First error: ${failedItems[0].error}` 
      : null;

    await this.completeBatch(batchId, errorSummary);

    return {
      batchId,
      total: items.length,
      success: results.filter(r => r.success).length,
      failed: failedItems.length,
      failedItems: failedItems.map(f => ({
        identifier: f.identifier,
        error: f.error
      }))
    };
  }

  async processWithRetry(batchId, itemId, processor, maxRetries) {
    let result = await this.processBatchItem(batchId, itemId, processor);
    
    for (let attempt = 0; attempt < maxRetries && !result.success; attempt++) {
      result = await this.processBatchItem(batchId, itemId, processor);
    }
    
    return result;
  }

  async getPendingItems(batchId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM batch_operation_items WHERE batch_id = ? AND status IN ('pending', 'failed')`,
        [batchId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getBatchStatus(batchId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM batch_operations WHERE id = ?`,
        [batchId],
        async (err, batch) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.all(
            `SELECT * FROM batch_operation_items WHERE batch_id = ?`,
            [batchId],
            (err, items) => {
              if (err) {
                reject(err);
                return;
              }
              
              const successItems = items.filter(i => i.status === 'success');
              const failedItems = items.filter(i => i.status === 'failed');
              const pendingItems = items.filter(i => i.status === 'pending');
              
              resolve({
                batch,
                items: {
                  total: items.length,
                  success: successItems.length,
                  failed: failedItems.length,
                  pending: pendingItems.length,
                  failedDetails: failedItems.map(f => ({
                    identifier: f.item_identifier,
                    error: f.error_message
                  }))
                }
              });
            }
          );
        }
      );
    });
  }

  async retryFailedItems(batchId, processor, options = {}) {
    const status = await this.getBatchStatus(batchId);
    const failedItems = status.items.failedDetails;
    
    if (failedItems.length === 0) {
      return { message: 'No failed items to retry', batchId };
    }

    return new Promise((resolve, reject) => {
      db.all(
        `SELECT id FROM batch_operation_items WHERE batch_id = ? AND status = 'failed'`,
        [batchId],
        async (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          await new Promise((res, rej) => {
            db.run(
              `UPDATE batch_operations SET status = 'processing' WHERE id = ?`,
              [batchId],
              (err) => {
                if (err) rej(err);
                else res();
              }
            );
          });

          const results = [];
          for (const row of rows) {
            const result = await this.processWithRetry(batchId, row.id, processor, options.retries || 1);
            results.push(result);
          }

          const finalCounts = await this.updateBatchCounts(batchId);
          await this.completeBatch(batchId);

          resolve({
            batchId,
            retriedCount: rows.length,
            newSuccess: results.filter(r => r.success).length,
            stillFailed: results.filter(r => !r.success).length,
            ...finalCounts
          });
        }
      );
    });
  }
}

module.exports = new BatchService();
