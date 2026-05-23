import db from '../database';
import { generateId, now, deepDiff, safeJsonStringify, safeJsonParse } from '../utils';
import { OperationType, QueueStatus, SourceType } from '../types';

export interface RecordHistoryOptions {
  queueItemId: string;
  operationType: OperationType;
  operator: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  comment?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const recordChangeHistory = (options: RecordHistoryOptions): string => {
  const { queueItemId, operationType, operator, beforeState, afterState, comment, ipAddress, userAgent } = options;
  const historyId = generateId();
  
  const diff = beforeState && afterState ? deepDiff(beforeState, afterState) : undefined;
  
  const stmt = db.prepare(`
    INSERT INTO change_history 
    (id, queue_item_id, operation_type, operator, operated_at, before_state, after_state, diff, comment, ip_address, user_agent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    historyId,
    queueItemId,
    operationType,
    operator,
    now(),
    beforeState ? safeJsonStringify(beforeState) : null,
    afterState ? safeJsonStringify(afterState) : null,
    diff && Object.keys(diff).length > 0 ? safeJsonStringify(diff) : null,
    comment,
    ipAddress,
    userAgent
  );
  
  return historyId;
};

export const getHistoryByQueueItem = (queueItemId: string): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM change_history 
    WHERE queue_item_id = ? 
    ORDER BY operated_at ASC
  `);
  const rows = stmt.all(queueItemId);
  
  return rows.map(row => ({
    ...row,
    before_state: safeJsonParse(row.before_state, null),
    after_state: safeJsonParse(row.after_state, null),
    diff: safeJsonParse(row.diff, null),
  }));
};

export const getHistoryByOperator = (operator: string, limit: number = 100): any[] => {
  const stmt = db.prepare(`
    SELECT * FROM change_history 
    WHERE operator = ? 
    ORDER BY operated_at DESC 
    LIMIT ?
  `);
  const rows = stmt.all(operator, limit);
  
  return rows.map(row => ({
    ...row,
    before_state: safeJsonParse(row.before_state, null),
    after_state: safeJsonParse(row.after_state, null),
    diff: safeJsonParse(row.diff, null),
  }));
};

export const getHistoryTimeline = (startDate?: number, endDate?: number): any[] => {
  let query = `
    SELECT ch.*, qi.source_type, qi.batch_id
    FROM change_history ch
    LEFT JOIN queue_items qi ON ch.queue_item_id = qi.id
  `;
  const params: any[] = [];
  
  if (startDate || endDate) {
    query += ' WHERE 1=1';
    if (startDate) {
      query += ' AND ch.operated_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND ch.operated_at <= ?';
      params.push(endDate);
    }
  }
  
  query += ' ORDER BY ch.operated_at DESC';
  
  const stmt = db.prepare(query);
  const rows = stmt.all(...params);
  
  return rows.map(row => ({
    ...row,
    before_state: safeJsonParse(row.before_state, null),
    after_state: safeJsonParse(row.after_state, null),
    diff: safeJsonParse(row.diff, null),
  }));
};

export const getChangeSummary = (queueItemId: string): any => {
  const history = getHistoryByQueueItem(queueItemId);
  
  const summary = {
    totalChanges: history.length,
    statusChanges: [] as any[],
    operators: new Set<string>(),
    firstChangeAt: history[0]?.operated_at,
    lastChangeAt: history[history.length - 1]?.operated_at,
  };
  
  for (const entry of history) {
    summary.operators.add(entry.operator);
    if (entry.diff?.status) {
      summary.statusChanges.push({
        from: entry.diff.status.before,
        to: entry.diff.status.after,
        by: entry.operator,
        at: entry.operated_at,
      });
    }
  }
  
  return {
    ...summary,
    operators: Array.from(summary.operators),
  };
};
