import db from '../database';
import { generateId, now, safeJsonParse, safeJsonStringify } from '../utils';
import { getQueueItem, updateQueueStatus } from './queue';
import { logInfo } from './logger';
import { QueueStatus, SourceType } from '../types';

export interface DeadLetterRetryHistory {
  attempt: number;
  error: string;
  at: number;
}

export const moveToDeadLetter = (
  queueItemId: string,
  operator: string,
  finalError: string
): string => {
  const queueItem = getQueueItem(queueItemId);
  if (!queueItem) {
    throw new Error(`Queue item ${queueItemId} not found`);
  }
  
  const existing = db.prepare('SELECT id FROM dead_letters WHERE queue_item_id = ?').get(queueItemId);
  if (existing) {
    return (existing as any).id;
  }
  
  const retryHistory: DeadLetterRetryHistory[] = [];
  if (queueItem.retry_count > 0) {
    retryHistory.push({
      attempt: queueItem.retry_count,
      error: queueItem.error_message || 'Unknown error',
      at: queueItem.last_retry_at || now(),
    });
  }
  
  const deadLetterId = generateId();
  const stmt = db.prepare(`
    INSERT INTO dead_letters 
    (id, queue_item_id, record_id, source_type, batch_id, original_error, retry_history, received_at, resolved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
  
  stmt.run(
    deadLetterId,
    queueItemId,
    queueItem.record_id,
    queueItem.source_type,
    queueItem.batch_id,
    finalError,
    safeJsonStringify(retryHistory),
    now()
  );
  
  updateQueueStatus(queueItemId, QueueStatus.DEAD_LETTER, operator, {
    error: new Error(finalError),
    comment: 'Moved to dead letter queue',
  });
  
  logInfo(`Queue item ${queueItemId} moved to dead letter`, { operator, finalError });
  
  return deadLetterId;
};

export const getDeadLetter = (id: string): any => {
  const stmt = db.prepare('SELECT * FROM dead_letters WHERE id = ?');
  const row = stmt.get(id);
  if (!row) return null;
  
  return {
    ...row,
    retry_history: safeJsonParse(row.retry_history, []),
    resolved: row.resolved === 1,
  };
};

export const getDeadLetterByQueueItem = (queueItemId: string): any => {
  const stmt = db.prepare('SELECT * FROM dead_letters WHERE queue_item_id = ?');
  const row = stmt.get(queueItemId);
  if (!row) return null;
  
  return {
    ...row,
    retry_history: safeJsonParse(row.retry_history, []),
    resolved: row.resolved === 1,
  };
};

export const getUnresolvedDeadLetters = (limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM dead_letters 
    WHERE resolved = 0
    ORDER BY received_at ASC
    LIMIT ?
  `);
  const rows = stmt.all(limit);
  
  return rows.map(row => ({
    ...row,
    retry_history: safeJsonParse(row.retry_history, []),
    resolved: row.resolved === 1,
  }));
};

export const resolveDeadLetter = (
  deadLetterId: string,
  operator: string,
  resolution: string,
  action: 'retry' | 'dismiss'
): void => {
  const deadLetter = getDeadLetter(deadLetterId);
  if (!deadLetter) {
    throw new Error(`Dead letter ${deadLetterId} not found`);
  }
  
  const stmt = db.prepare(`
    UPDATE dead_letters 
    SET resolved = 1, resolved_by = ?, resolved_at = ?, resolution = ?
    WHERE id = ?
  `);
  
  stmt.run(operator, now(), resolution, deadLetterId);
  
  if (action === 'retry') {
    const resetStmt = db.prepare(`
      UPDATE queue_items 
      SET status = ?, retry_count = 0, error_message = NULL, error_stack = NULL, updated_at = ?
      WHERE id = ?
    `);
    resetStmt.run(QueueStatus.PENDING, now(), deadLetter.queue_item_id);
  }
  
  logInfo(`Dead letter ${deadLetterId} resolved`, { operator, resolution, action });
};

export const getDeadLetterStatistics = (): any => {
  const total = db.prepare('SELECT COUNT(*) as count FROM dead_letters').get() as any;
  const unresolved = db.prepare('SELECT COUNT(*) as count FROM dead_letters WHERE resolved = 0').get() as any;
  const bySource = db.prepare(`
    SELECT source_type, COUNT(*) as count
    FROM dead_letters
    WHERE resolved = 0
    GROUP BY source_type
  `).all();
  
  return {
    total: total.count,
    unresolved: unresolved.count,
    bySource: Object.fromEntries(bySource.map((s: any) => [s.source_type, s.count])),
  };
};
