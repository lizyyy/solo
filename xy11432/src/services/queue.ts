import db from '../database';
import { generateId, now, calculateNextRetry, safeJsonParse, safeJsonStringify } from '../utils';
import { recordChangeHistory } from './history';
import { logError, logInfo, logWarn } from './logger';
import { QueueStatus, OperationType, SourceType, RetryStrategy } from '../types';

export interface CreateQueueItemOptions {
  recordId: string;
  sourceType: SourceType;
  batchId: string;
  maxRetries?: number;
  submittedBy: string;
  initialData?: Record<string, any>;
}

export const createQueueItem = (options: CreateQueueItemOptions): string => {
  const { recordId, sourceType, batchId, maxRetries = 3, submittedBy, initialData } = options;
  const queueItemId = generateId();
  
  const stmt = db.prepare(`
    INSERT INTO queue_items 
    (id, record_id, source_type, batch_id, status, retry_count, max_retries, frozen, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
  `);
  
  stmt.run(
    queueItemId,
    recordId,
    sourceType,
    batchId,
    QueueStatus.PENDING,
    maxRetries,
    now(),
    now()
  );
  
  recordChangeHistory({
    queueItemId,
    operationType: OperationType.SUBMIT,
    operator: submittedBy,
    afterState: {
      status: QueueStatus.PENDING,
      retryCount: 0,
      ...initialData,
    },
  });
  
  return queueItemId;
};

export const getQueueItem = (id: string): any => {
  const stmt = db.prepare('SELECT * FROM queue_items WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  
  return {
    ...row,
    frozen: row.frozen === 1,
  };
};

export const getQueueItemsByBatch = (batchId: string): any[] => {
  const stmt = db.prepare('SELECT * FROM queue_items WHERE batch_id = ? ORDER BY created_at ASC');
  const rows = stmt.all(batchId);
  return rows.map(row => ({
    ...row,
    frozen: row.frozen === 1,
  }));
};

export const getPendingItems = (limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM queue_items 
    WHERE status = ? AND frozen = 0
    ORDER BY created_at ASC 
    LIMIT ?
  `);
  const rows = stmt.all(QueueStatus.PENDING, limit);
  return rows.map(row => ({
    ...row,
    frozen: row.frozen === 1,
  }));
};

export const getRetryableItems = (limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM queue_items 
    WHERE status = ? AND next_retry_at <= ? AND frozen = 0 AND retry_count < max_retries
    ORDER BY next_retry_at ASC 
    LIMIT ?
  `);
  const rows = stmt.all(QueueStatus.RETRYING, now(), limit);
  return rows.map(row => ({
    ...row,
    frozen: row.frozen === 1,
  }));
};

export const updateQueueStatus = (
  id: string,
  status: QueueStatus,
  operator: string,
  options?: {
    error?: Error;
    processedBy?: string;
    comment?: string;
  }
): void => {
  const before = getQueueItem(id);
  if (!before) {
    throw new Error(`Queue item ${id} not found`);
  }
  
  if (before.frozen && status !== QueueStatus.FROZEN && status !== QueueStatus.CANCELLED) {
    throw new Error(`Queue item ${id} is frozen and cannot be modified`);
  }
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, processed_by = ?, processed_at = ?, error_message = ?, error_stack = ?, updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(
    status,
    options?.processedBy || operator,
    now(),
    options?.error?.message || null,
    options?.error?.stack || null,
    now(),
    id
  );
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.RETRY,
    operator,
    beforeState: before,
    afterState: after,
    comment: options?.comment,
  });
};

export const markForRetry = (id: string, operator: string, error?: Error): void => {
  const before = getQueueItem(id);
  if (!before) {
    throw new Error(`Queue item ${id} not found`);
  }
  
  const newRetryCount = before.retry_count + 1;
  const nextRetryAt = calculateNextRetry(newRetryCount);
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, retry_count = ?, last_retry_at = ?, next_retry_at = ?, error_message = ?, error_stack = ?, updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(
    QueueStatus.RETRYING,
    newRetryCount,
    now(),
    nextRetryAt,
    error?.message || null,
    error?.stack || null,
    now(),
    id
  );
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.RETRY,
    operator,
    beforeState: before,
    afterState: after,
    comment: `Retry attempt ${newRetryCount}`,
  });
  
  if (newRetryCount >= before.max_retries) {
    logWarn(`Queue item ${id} has exhausted all retry attempts`, { retryCount: newRetryCount });
  }
};

export const markAsProcessing = (id: string, operator: string): void => {
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, processed_by = ?, processed_at = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(QueueStatus.PROCESSING, operator, now(), now(), id);
};

export const markAsManualReview = (id: string, operator: string, comment: string): void => {
  const before = getQueueItem(id);
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(QueueStatus.MANUAL_REVIEW, now(), id);
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.MANUAL_DECISION,
    operator,
    beforeState: before,
    afterState: after,
    comment,
  });
  
  logInfo(`Queue item ${id} marked for manual review`, { operator, comment });
};

export const freezeQueueItem = (id: string, operator: string, reason: string): void => {
  const before = getQueueItem(id);
  if (!before) {
    throw new Error(`Queue item ${id} not found`);
  }
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET frozen = 1, frozen_by = ?, frozen_at = ?, frozen_reason = ?, updated_at = ?
    WHERE id = ?
  `);
  
  stmt.run(operator, now(), reason, now(), id);
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.FREEZE,
    operator,
    beforeState: before,
    afterState: after,
    comment: reason,
  });
  
  logInfo(`Queue item ${id} frozen`, { operator, reason });
};

export const unfreezeQueueItem = (id: string, operator: string, reason: string): void => {
  const before = getQueueItem(id);
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET frozen = 0, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(now(), id);
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.UNFREEZE,
    operator,
    beforeState: before,
    afterState: after,
    comment: reason,
  });
};

export const cancelQueueItem = (id: string, operator: string, reason: string): void => {
  const before = getQueueItem(id);
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(QueueStatus.CANCELLED, now(), id);
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.CANCEL,
    operator,
    beforeState: before,
    afterState: after,
    comment: reason,
  });
  
  logInfo(`Queue item ${id} cancelled`, { operator, reason });
};

export const closeQueueItem = (id: string, operator: string, comment?: string): void => {
  const before = getQueueItem(id);
  
  const stmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(QueueStatus.CLOSED, now(), id);
  
  const after = getQueueItem(id);
  
  recordChangeHistory({
    queueItemId: id,
    operationType: OperationType.CLOSE,
    operator,
    beforeState: before,
    afterState: after,
    comment,
  });
};

export const getQueueStatistics = (): any => {
  const stats = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM queue_items
    GROUP BY status
  `).all();
  
  const frozen = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue_items
    WHERE frozen = 1
  `).get();
  
  return {
    byStatus: Object.fromEntries(stats.map((s: any) => [s.status, s.count])),
    frozenCount: (frozen as any).count,
  };
};

export const checkDuplicateRecord = (sourceType: SourceType, batchId: string, sourceId: string): boolean => {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM records 
    WHERE source_type = ? AND batch_id = ? AND source_id = ?
  `);
  const result = stmt.get(sourceType, batchId, sourceId) as any;
  return result.count > 0;
};

export const getExistingRecord = (sourceType: SourceType, batchId: string, sourceId: string): any => {
  const stmt = db.prepare(`
    SELECT * FROM records 
    WHERE source_type = ? AND batch_id = ? AND source_id = ?
  `);
  return stmt.get(sourceType, batchId, sourceId);
};
