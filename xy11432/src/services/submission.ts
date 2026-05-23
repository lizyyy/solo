import db from '../database';
import { generateId, now, safeJsonStringify, safeJsonParse } from '../utils';
import { createQueueItem, checkDuplicateRecord, getExistingRecord, getQueueItem, cancelQueueItem } from './queue';
import { recordChangeHistory } from './history';
import { logInfo, logWarn, logError } from './logger';
import { SourceType, RetryStrategy, OperationType, SubmitRequest, QueueStatus } from '../types';

export interface SubmissionResult {
  batchId: string;
  totalItems: number;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  queueItemIds: string[];
  results: Array<{
    sourceId: string;
    status: 'created' | 'skipped' | 'overwritten' | 'appended' | 'failed';
    queueItemId?: string;
    message?: string;
  }>;
}

export const submitRecords = (
  request: SubmitRequest,
  options?: {
    maxRetries?: number;
  }
): SubmissionResult => {
  const { sourceType, batchId, items, submittedBy, retryStrategy = RetryStrategy.IGNORE, comment } = request;
  
  const result: SubmissionResult = {
    batchId,
    totalItems: items.length,
    processedItems: 0,
    skippedItems: 0,
    failedItems: 0,
    queueItemIds: [],
    results: [],
  };
  
  for (const item of items) {
    try {
      const isDuplicate = checkDuplicateRecord(sourceType, batchId, item.sourceId);
      
      if (isDuplicate) {
        switch (retryStrategy) {
          case RetryStrategy.IGNORE:
            result.skippedItems++;
            result.results.push({
              sourceId: item.sourceId,
              status: 'skipped',
              message: 'Duplicate record skipped',
            });
            continue;
            
          case RetryStrategy.OVERWRITE:
            const existing = getExistingRecord(sourceType, batchId, item.sourceId);
            const updateStmt = db.prepare(`
              UPDATE records 
              SET data = ?, submitted_by = ?, submitted_at = ?
              WHERE source_type = ? AND batch_id = ? AND source_id = ?
            `);
            updateStmt.run(
              safeJsonStringify(item.data),
              submittedBy,
              now(),
              sourceType,
              batchId,
              item.sourceId
            );
            
            const existingQueue = db.prepare(`
              SELECT id FROM queue_items 
              WHERE record_id = ?
            `).get(existing.id);
            
            if (existingQueue) {
              result.queueItemIds.push((existingQueue as any).id);
            }
            
            result.processedItems++;
            result.results.push({
              sourceId: item.sourceId,
              status: 'overwritten',
              queueItemId: existingQueue?.id,
              message: 'Duplicate record overwritten',
            });
            continue;
            
          case RetryStrategy.APPEND:
            const newRecordId = generateId();
            const insertStmt = db.prepare(`
              INSERT INTO records (id, source_type, batch_id, source_id, data, submitted_by, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insertStmt.run(
              newRecordId,
              sourceType,
              batchId,
              `${item.sourceId}_${now()}`,
              safeJsonStringify(item.data),
              submittedBy,
              now()
            );
            
            const queueItemId = createQueueItem({
              recordId: newRecordId,
              sourceType,
              batchId,
              maxRetries: options?.maxRetries || 3,
              submittedBy,
              initialData: item.data,
            });
            
            result.queueItemIds.push(queueItemId);
            result.processedItems++;
            result.results.push({
              sourceId: item.sourceId,
              status: 'appended',
              queueItemId,
              message: 'Duplicate record appended with timestamp',
            });
            continue;
        }
      }
      
      const recordId = generateId();
      const insertStmt = db.prepare(`
        INSERT INTO records (id, source_type, batch_id, source_id, data, submitted_by, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertStmt.run(
        recordId,
        sourceType,
        batchId,
        item.sourceId,
        safeJsonStringify(item.data),
        submittedBy,
        now()
      );
      
      const queueItemId = createQueueItem({
        recordId,
        sourceType,
        batchId,
        maxRetries: options?.maxRetries || 3,
        submittedBy,
        initialData: item.data,
      });
      
      result.queueItemIds.push(queueItemId);
      result.processedItems++;
      result.results.push({
        sourceId: item.sourceId,
        status: 'created',
        queueItemId,
      });
    } catch (error) {
      result.failedItems++;
      result.results.push({
        sourceId: item.sourceId,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      logError(`Failed to process item ${item.sourceId}`, error as Error, { batchId, sourceType });
    }
  }
  
  logInfo(`Batch submission completed`, {
    batchId,
    sourceType,
    submittedBy,
    total: result.totalItems,
    processed: result.processedItems,
    skipped: result.skippedItems,
    failed: result.failedItems,
    retryStrategy,
  });
  
  return result;
};

export const resubmitCancelledItem = (
  queueItemId: string,
  operator: string,
  newData?: Record<string, any>
): string => {
  const queueItem = getQueueItem(queueItemId);
  if (!queueItem) {
    throw new Error(`Queue item ${queueItemId} not found`);
  }
  
  if (queueItem.status !== QueueStatus.CANCELLED) {
    throw new Error(`Queue item ${queueItemId} is not in cancelled status`);
  }
  
  const before = { ...queueItem };
  
  const updateStmt = db.prepare(`
    UPDATE queue_items 
    SET status = ?, retry_count = 0, error_message = NULL, error_stack = NULL, updated_at = ?
    WHERE id = ?
  `);
  updateStmt.run(QueueStatus.PENDING, now(), queueItemId);
  
  if (newData) {
    const recordStmt = db.prepare(`
      UPDATE records 
      SET data = ?, submitted_by = ?, submitted_at = ?
      WHERE id = ?
    `);
    recordStmt.run(safeJsonStringify(newData), operator, now(), queueItem.record_id);
  }
  
  recordChangeHistory({
    queueItemId,
    operationType: OperationType.RESUBMIT,
    operator,
    beforeState: before,
    afterState: {
      ...before,
      status: QueueStatus.PENDING,
      retryCount: 0,
    },
    comment: 'Item resubmitted after cancellation',
  });
  
  logInfo(`Queue item ${queueItemId} resubmitted`, { operator });
  
  return queueItemId;
};

export const getRecord = (recordId: string): any => {
  const stmt = db.prepare('SELECT * FROM records WHERE id = ?');
  const row = stmt.get(recordId);
  if (!row) return null;
  
  return {
    ...row,
    data: safeJsonParse(row.data, {}),
  };
};

export const getRecordsByBatch = (batchId: string): any[] => {
  const stmt = db.prepare('SELECT * FROM records WHERE batch_id = ? ORDER BY submitted_at ASC');
  const rows = stmt.all(batchId);
  
  return rows.map(row => ({
    ...row,
    data: safeJsonParse(row.data, {}),
  }));
};

export const getRecordsBySourceType = (sourceType: SourceType, limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM records 
    WHERE source_type = ? 
    ORDER BY submitted_at DESC 
    LIMIT ?
  `);
  const rows = stmt.all(sourceType, limit);
  
  return rows.map(row => ({
    ...row,
    data: safeJsonParse(row.data, {}),
  }));
};
