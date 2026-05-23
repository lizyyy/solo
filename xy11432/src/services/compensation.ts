import db from '../database';
import { generateId, now, safeJsonParse } from '../utils';
import { getQueueItem, updateQueueStatus } from './queue';
import { recordChangeHistory } from './history';
import { logInfo } from './logger';
import { QueueStatus, OperationType, SourceType } from '../types';

export interface CompensationEntry {
  queueItemId: string;
  recordId: string;
  sourceType: SourceType;
  batchId: string;
  entryType: 'debit' | 'credit' | 'adjustment';
  amount?: number;
  quantity?: number;
  accountCode?: string;
  postedBy: string;
  reference?: string;
  notes?: string;
}

export const postCompensation = (entry: CompensationEntry): string => {
  const queueItem = getQueueItem(entry.queueItemId);
  if (!queueItem) {
    throw new Error(`Queue item ${entry.queueItemId} not found`);
  }
  
  if (queueItem.frozen) {
    throw new Error(`Queue item ${entry.queueItemId} is frozen, cannot post compensation`);
  }
  
  const before = {
    status: queueItem.status,
  };
  
  const ledgerId = generateId();
  const stmt = db.prepare(`
    INSERT INTO compensation_ledger 
    (id, queue_item_id, record_id, source_type, batch_id, entry_type, amount, quantity, account_code, posted_by, posted_at, reference, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    ledgerId,
    entry.queueItemId,
    entry.recordId,
    entry.sourceType,
    entry.batchId,
    entry.entryType,
    entry.amount,
    entry.quantity,
    entry.accountCode,
    entry.postedBy,
    now(),
    entry.reference,
    entry.notes
  );
  
  updateQueueStatus(
    entry.queueItemId,
    QueueStatus.SUCCESS,
    entry.postedBy,
    { comment: `Compensation posted: ${entry.entryType}` }
  );
  
  recordChangeHistory({
    queueItemId: entry.queueItemId,
    operationType: OperationType.COMPENSATE,
    operator: entry.postedBy,
    beforeState: before,
    afterState: {
      status: QueueStatus.SUCCESS,
      ledgerId,
      entryType: entry.entryType,
      amount: entry.amount,
      quantity: entry.quantity,
    },
    comment: entry.notes || 'Compensation entry posted',
  });
  
  logInfo(`Compensation posted for queue item ${entry.queueItemId}`, {
    ledgerId,
    entryType: entry.entryType,
    operator: entry.postedBy,
  });
  
  return ledgerId;
};

export const getCompensationByQueueItem = (queueItemId: string): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM compensation_ledger 
    WHERE queue_item_id = ?
    ORDER BY posted_at ASC
  `);
  return stmt.all(queueItemId);
};

export const getCompensationByBatch = (batchId: string): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM compensation_ledger 
    WHERE batch_id = ?
    ORDER BY posted_at ASC
  `);
  return stmt.all(batchId);
};

export const addSupervisorComment = (
  queueItemId: string,
  comment: string,
  commentedBy: string,
  isAppendOnly: boolean = true
): string => {
  const queueItem = getQueueItem(queueItemId);
  if (!queueItem) {
    throw new Error(`Queue item ${queueItemId} not found`);
  }
  
  const existingComments = db.prepare(`
    SELECT MAX(version) as max_version 
    FROM supervisor_comments 
    WHERE queue_item_id = ?
  `).get(queueItemId) as any;
  
  const version = (existingComments?.max_version || 0) + 1;
  const commentId = generateId();
  
  const stmt = db.prepare(`
    INSERT INTO supervisor_comments 
    (id, queue_item_id, comment, commented_by, commented_at, is_append_only, version)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    commentId,
    queueItemId,
    comment,
    commentedBy,
    now(),
    isAppendOnly ? 1 : 0,
    version
  );
  
  recordChangeHistory({
    queueItemId,
    operationType: OperationType.COMMENT,
    operator: commentedBy,
    afterState: {
      commentId,
      version,
      commentPreview: comment.substring(0, 100),
    },
    comment: 'Supervisor comment added',
  });
  
  return commentId;
};

export const getSupervisorComments = (queueItemId: string): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM supervisor_comments 
    WHERE queue_item_id = ?
    ORDER BY version ASC
  `);
  return stmt.all(queueItemId).map(row => ({
    ...row,
    is_append_only: row.is_append_only === 1,
  }));
};

export const getLedgerSummary = (batchId?: string): any => {
  let query = `
    SELECT 
      entry_type,
      COUNT(*) as count,
      SUM(amount) as total_amount,
      SUM(quantity) as total_quantity
    FROM compensation_ledger
  `;
  const params: any[] = [];
  
  if (batchId) {
    query += ' WHERE batch_id = ?';
    params.push(batchId);
  }
  
  query += ' GROUP BY entry_type';
  
  const rows = db.prepare(query).all(...params);
  
  return {
    byType: Object.fromEntries(rows.map((r: any) => [r.entry_type, {
      count: r.count,
      totalAmount: r.total_amount || 0,
      totalQuantity: r.total_quantity || 0,
    }])),
  };
};
