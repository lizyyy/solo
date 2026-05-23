import db from '../src/database';
import { submitRecords, getRecordsByBatch, resubmitCancelledItem } from '../src/services/submission';
import {
  getQueueItem,
  markForRetry,
  cancelQueueItem,
  freezeQueueItem,
  unfreezeQueueItem,
  checkDuplicateRecord,
  getQueueStatistics,
} from '../src/services/queue';
import { moveToDeadLetter, getDeadLetterStatistics, resolveDeadLetter } from '../src/services/deadLetter';
import { postCompensation, addSupervisorComment } from '../src/services/compensation';
import { getHistoryByQueueItem, getChangeSummary } from '../src/services/history';
import { classifyRetriableItems, exportAuditData } from '../src/services/export';
import { runAllAuditChecks } from '../src/services/audit';
import { SourceType, RetryStrategy, QueueStatus } from '../src/types';

beforeAll(() => {
  db.exec('DELETE FROM change_history');
  db.exec('DELETE FROM supervisor_comments');
  db.exec('DELETE FROM compensation_ledger');
  db.exec('DELETE FROM dead_letters');
  db.exec('DELETE FROM queue_items');
  db.exec('DELETE FROM records');
  db.exec('DELETE FROM export_snapshots');
  db.exec('DELETE FROM system_logs');
});

afterAll(() => {
  db.close();
});

describe('Submission Service', () => {
  test('should submit records successfully', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-001',
      items: [
        { sourceId: 'receipt-001', data: { amount: 100, item: '试管' } },
        { sourceId: 'receipt-002', data: { amount: 200, item: '烧杯' } },
      ],
      submittedBy: 'teacher_01',
    });

    expect(result.totalItems).toBe(2);
    expect(result.processedItems).toBe(2);
    expect(result.queueItemIds.length).toBe(2);
  });

  test('should handle duplicate with IGNORE strategy', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-001',
      items: [
        { sourceId: 'receipt-001', data: { amount: 150, item: '试管' } },
      ],
      submittedBy: 'teacher_01',
      retryStrategy: RetryStrategy.IGNORE,
    });

    expect(result.skippedItems).toBe(1);
    expect(result.results[0].status).toBe('skipped');
  });

  test('should handle duplicate with OVERWRITE strategy', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-001',
      items: [
        { sourceId: 'receipt-001', data: { amount: 150, item: '试管', note: 'updated' } },
      ],
      submittedBy: 'teacher_02',
      retryStrategy: RetryStrategy.OVERWRITE,
    });

    expect(result.processedItems).toBe(1);
    expect(result.results[0].status).toBe('overwritten');
  });

  test('should handle duplicate with APPEND strategy', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-001',
      items: [
        { sourceId: 'receipt-001', data: { amount: 175, item: '试管', note: 'appended' } },
      ],
      submittedBy: 'teacher_03',
      retryStrategy: RetryStrategy.APPEND,
    });

    expect(result.processedItems).toBe(1);
    expect(result.results[0].status).toBe('appended');
  });

  test('should submit purchase arrival records', () => {
    const result = submitRecords({
      sourceType: SourceType.PURCHASE_ARRIVAL,
      batchId: 'batch-purchase-001',
      items: [
        { sourceId: 'purchase-001', data: { supplier: '供应商A', quantity: 500, unit: '个' } },
      ],
      submittedBy: 'purchase_officer',
    });

    expect(result.processedItems).toBe(1);
  });

  test('should submit teacher sign records', () => {
    const result = submitRecords({
      sourceType: SourceType.TEACHER_SIGN,
      batchId: 'batch-sign-001',
      items: [
        { sourceId: 'sign-001', data: { teacher: '张老师', course: '化学实验', date: '2024-01-15' } },
      ],
      submittedBy: 'assistant_01',
    });

    expect(result.processedItems).toBe(1);
  });
});

describe('Queue Service', () => {
  let queueItemId: string;

  beforeAll(() => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-queue-test',
      items: [{ sourceId: 'queue-test-001', data: { test: 'data' } }],
      submittedBy: 'test_user',
    });
    queueItemId = result.queueItemIds[0];
  });

  test('should get queue item', () => {
    const item = getQueueItem(queueItemId);
    expect(item).not.toBeNull();
    expect(item.status).toBe(QueueStatus.PENDING);
    expect(item.frozen).toBe(false);
  });

  test('should mark for retry', () => {
    markForRetry(queueItemId, 'test_operator', new Error('Test error'));
    const item = getQueueItem(queueItemId);
    expect(item.status).toBe(QueueStatus.RETRYING);
    expect(item.retry_count).toBe(1);
    expect(item.error_message).toBe('Test error');
  });

  test('should freeze queue item', () => {
    freezeQueueItem(queueItemId, 'supervisor', 'Audit review');
    const item = getQueueItem(queueItemId);
    expect(item.frozen).toBe(true);
    expect(item.frozen_reason).toBe('Audit review');
  });

  test('should unfreeze queue item', () => {
    unfreezeQueueItem(queueItemId, 'supervisor', 'Review completed');
    const item = getQueueItem(queueItemId);
    expect(item.frozen).toBe(false);
  });

  test('should cancel queue item', () => {
    cancelQueueItem(queueItemId, 'admin', 'Duplicate entry');
    const item = getQueueItem(queueItemId);
    expect(item.status).toBe(QueueStatus.CANCELLED);
  });

  test('should resubmit cancelled item', () => {
    const resubmittedId = resubmitCancelledItem(queueItemId, 'admin', { test: 'updated data' });
    const item = getQueueItem(resubmittedId);
    expect(item.status).toBe(QueueStatus.PENDING);
    expect(item.retry_count).toBe(0);
  });

  test('should get queue statistics', () => {
    const stats = getQueueStatistics();
    expect(stats.byStatus).toBeDefined();
    expect(stats.frozenCount).toBeDefined();
  });
});

describe('Dead Letter Service', () => {
  let queueItemId: string;
  let deadLetterId: string;

  beforeAll(() => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-dl-test',
      items: [{ sourceId: 'dl-test-001', data: { test: 'data' } }],
      submittedBy: 'test_user',
    });
    queueItemId = result.queueItemIds[0];
  });

  test('should move to dead letter', () => {
    markForRetry(queueItemId, 'system', new Error('Error 1'));
    markForRetry(queueItemId, 'system', new Error('Error 2'));
    markForRetry(queueItemId, 'system', new Error('Error 3'));
    
    deadLetterId = moveToDeadLetter(queueItemId, 'system', 'Max retries exceeded');
    expect(deadLetterId).toBeDefined();
    
    const queueItem = getQueueItem(queueItemId);
    expect(queueItem.status).toBe(QueueStatus.DEAD_LETTER);
  });

  test('should resolve dead letter with retry', () => {
    resolveDeadLetter(deadLetterId, 'admin', 'Fixed upstream issue', 'retry');
    const queueItem = getQueueItem(queueItemId);
    expect(queueItem.status).toBe(QueueStatus.PENDING);
    expect(queueItem.retry_count).toBe(0);
  });

  test('should get dead letter statistics', () => {
    const stats = getDeadLetterStatistics();
    expect(stats.total).toBeDefined();
    expect(stats.unresolved).toBeDefined();
  });
});

describe('Compensation Service', () => {
  let queueItemId: string;

  beforeAll(() => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-comp-test',
      items: [{ sourceId: 'comp-test-001', data: { amount: 100 } }],
      submittedBy: 'test_user',
    });
    queueItemId = result.queueItemIds[0];
  });

  test('should add supervisor comment', () => {
    const commentId = addSupervisorComment(
      queueItemId,
      '已审核，数据准确无误',
      'supervisor_01',
      true
    );
    expect(commentId).toBeDefined();
  });

  test('should post compensation entry', () => {
    const record = db.prepare('SELECT * FROM queue_items WHERE id = ?').get(queueItemId) as any;
    
    const ledgerId = postCompensation({
      queueItemId,
      recordId: record.record_id,
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-comp-test',
      entryType: 'adjustment',
      amount: 50,
      quantity: 10,
      accountCode: 'EXP-001',
      postedBy: 'finance_01',
      notes: '补偿入账',
    });
    
    expect(ledgerId).toBeDefined();
    
    const updatedQueue = getQueueItem(queueItemId);
    expect(updatedQueue.status).toBe(QueueStatus.SUCCESS);
  });
});

describe('History Service', () => {
  let queueItemId: string;

  beforeAll(() => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-hist-test',
      items: [{ sourceId: 'hist-test-001', data: { test: 'data' } }],
      submittedBy: 'test_user',
    });
    queueItemId = result.queueItemIds[0];
    
    markForRetry(queueItemId, 'operator1', new Error('Test error'));
    cancelQueueItem(queueItemId, 'admin', 'Cancelled for test');
  });

  test('should get history by queue item', () => {
    const history = getHistoryByQueueItem(queueItemId);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].operation_type).toBeDefined();
  });

  test('should get change summary', () => {
    const summary = getChangeSummary(queueItemId);
    expect(summary.totalChanges).toBeGreaterThan(0);
    expect(summary.operators.length).toBeGreaterThan(0);
    expect(summary.statusChanges).toBeDefined();
  });
});

describe('Export Service', () => {
  test('should classify retriable items', () => {
    const classifications = classifyRetriableItems();
    expect(Array.isArray(classifications)).toBe(true);
    expect(classifications[0]?.category).toBeDefined();
    expect(classifications[0]?.count).toBeDefined();
  });

  test('should export audit data as JSON', () => {
    const result = exportAuditData(
      { format: 'json', includeHistory: true },
      'audit_user'
    );
    
    expect(result.snapshotId).toBeDefined();
    expect(result.recordCount).toBeGreaterThan(0);
    expect(result.format).toBe('json');
  });

  test('should export audit data as CSV', () => {
    const result = exportAuditData(
      { format: 'csv' },
      'audit_user'
    );
    
    expect(result.snapshotId).toBeDefined();
    expect(result.recordCount).toBeGreaterThan(0);
    expect(result.format).toBe('csv');
    expect(result.content.includes(',')).toBe(true);
  });
});

describe('Audit Checks', () => {
  test('should run all audit checks', () => {
    const results = runAllAuditChecks();
    
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(7);
    
    const checkNames = results.map(r => r.checkName);
    expect(checkNames).toContain('duplicate_import_check');
    expect(checkNames).toContain('permission_interception_check');
    expect(checkNames).toContain('exception_retention_check');
    expect(checkNames).toContain('restart_history_check');
    expect(checkNames).toContain('export_consistency_check');
    expect(checkNames).toContain('frozen_items_check');
    expect(checkNames).toContain('orphaned_records_check');
    
    for (const result of results) {
      expect(result.checkName).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(result.message).toBeDefined();
    }
  });
});

describe('Edge Cases', () => {
  test('should detect duplicate records', () => {
    const isDuplicate = checkDuplicateRecord(
      SourceType.RECEIPT,
      'batch-001',
      'receipt-001'
    );
    expect(isDuplicate).toBe(true);
  });

  test('should not allow modification of frozen items', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-frozen-test',
      items: [{ sourceId: 'frozen-test-001', data: {} }],
      submittedBy: 'test_user',
    });
    const queueItemId = result.queueItemIds[0];
    
    freezeQueueItem(queueItemId, 'admin', 'Test freeze');
    
    expect(() => {
      markForRetry(queueItemId, 'operator', new Error('Should fail'));
    }).toThrow();
  });

  test('should not resubmit non-cancelled items', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-resubmit-test',
      items: [{ sourceId: 'resubmit-test-001', data: {} }],
      submittedBy: 'test_user',
    });
    const queueItemId = result.queueItemIds[0];
    
    expect(() => {
      resubmitCancelledItem(queueItemId, 'admin');
    }).toThrow();
  });

  test('should handle partial batch submission', () => {
    const result = submitRecords({
      sourceType: SourceType.RECEIPT,
      batchId: 'batch-partial-test',
      items: [
        { sourceId: 'partial-001', data: { valid: true } },
        { sourceId: 'partial-002', data: { valid: true } },
      ],
      submittedBy: 'test_user',
    });
    
    expect(result.processedItems).toBe(2);
    expect(result.failedItems).toBe(0);
  });
});
