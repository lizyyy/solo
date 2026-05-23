import db from '../database';
import { generateId, now, hashContent, safeJsonParse, safeJsonStringify } from '../utils';
import { getHistoryByQueueItem } from './history';
import { getSupervisorComments, getCompensationByQueueItem } from './compensation';
import { logInfo } from './logger';
import { ExportRequest, QueueStatus, SourceType, RetryClassification } from '../types';
import { Parser } from 'json2csv';

export const exportAuditData = (
  request: ExportRequest,
  exportedBy: string
): {
  format: string;
  content: string;
  snapshotId: string;
  recordCount: number;
} => {
  const { format, filters, includeHistory, includeDeadLetter } = request;
  
  let query = `
    SELECT 
      qi.*,
      r.data as record_data,
      r.source_id,
      r.submitted_by as record_submitted_by,
      r.submitted_at as record_submitted_at
    FROM queue_items qi
    LEFT JOIN records r ON qi.record_id = r.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (filters?.sourceType && filters.sourceType.length > 0) {
    const placeholders = filters.sourceType.map(() => '?').join(',');
    query += ` AND qi.source_type IN (${placeholders})`;
    params.push(...filters.sourceType);
  }
  
  if (filters?.status && filters.status.length > 0) {
    const placeholders = filters.status.map(() => '?').join(',');
    query += ` AND qi.status IN (${placeholders})`;
    params.push(...filters.status);
  }
  
  if (filters?.batchId) {
    query += ` AND qi.batch_id = ?`;
    params.push(filters.batchId);
  }
  
  if (filters?.startDate) {
    query += ` AND qi.created_at >= ?`;
    params.push(filters.startDate);
  }
  
  if (filters?.endDate) {
    query += ` AND qi.created_at <= ?`;
    params.push(filters.endDate);
  }
  
  query += ` ORDER BY qi.created_at ASC`;
  
  const rows = db.prepare(query).all(...params);
  
  const enrichedData = rows.map((row: any) => {
    const item: any = {
      id: row.id,
      queueItemId: row.id,
      recordId: row.record_id,
      sourceType: row.source_type,
      batchId: row.batch_id,
      sourceId: row.source_id,
      status: row.status,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      lastRetryAt: row.last_retry_at,
      nextRetryAt: row.next_retry_at,
      processedBy: row.processed_by,
      processedAt: row.processed_at,
      errorMessage: row.error_message,
      frozen: row.frozen === 1,
      frozenBy: row.frozen_by,
      frozenAt: row.frozen_at,
      frozenReason: row.frozen_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      recordData: safeJsonParse(row.record_data, {}),
      recordSubmittedBy: row.record_submitted_by,
      recordSubmittedAt: row.record_submitted_at,
    };
    
    if (includeHistory) {
      item.changeHistory = getHistoryByQueueItem(row.id);
    }
    
    item.supervisorComments = getSupervisorComments(row.id);
    item.compensationEntries = getCompensationByQueueItem(row.id);
    
    return item;
  });
  
  let content: string;
  
  if (format === 'csv') {
    const json2csvParser = new Parser({
      fields: [
        'queueItemId',
        'recordId',
        'sourceType',
        'batchId',
        'sourceId',
        'status',
        'retryCount',
        'maxRetries',
        'errorMessage',
        'frozen',
        'createdAt',
        'updatedAt',
        'recordSubmittedBy',
      ],
    });
    content = json2csvParser.parse(enrichedData);
  } else {
    content = JSON.stringify(enrichedData, null, 2);
  }
  
  const contentHash = hashContent(content);
  
  const snapshotId = generateId();
  const snapshotStmt = db.prepare(`
    INSERT INTO export_snapshots 
    (id, export_type, filters, content_hash, exported_by, exported_at, record_count, frozen_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  snapshotStmt.run(
    snapshotId,
    'audit',
    safeJsonStringify(filters || {}),
    contentHash,
    exportedBy,
    now(),
    enrichedData.length
  );
  
  logInfo(`Audit data exported`, {
    snapshotId,
    exportedBy,
    format,
    recordCount: enrichedData.length,
    filters,
  });
  
  return {
    format,
    content,
    snapshotId,
    recordCount: enrichedData.length,
  };
};

export const classifyRetriableItems = (): RetryClassification[] => {
  const query = `
    SELECT 
      qi.id,
      qi.source_type,
      qi.error_message,
      qi.last_retry_at,
      qi.retry_count,
      qi.max_retries
    FROM queue_items qi
    WHERE qi.status IN (?, ?)
      AND qi.frozen = 0
      AND qi.retry_count < qi.max_retries
    ORDER BY qi.last_retry_at ASC
  `;
  
  const rows = db.prepare(query).all(QueueStatus.RETRYING, QueueStatus.FAILED);
  
  const classifications = new Map<string, RetryClassification>();
  
  for (const row of rows as any[]) {
    const errorMsg = row.error_message || 'unknown_error';
    let category = 'other_errors';
    
    if (errorMsg.includes('network') || errorMsg.includes('timeout') || errorMsg.includes('connection')) {
      category = 'network_errors';
    } else if (errorMsg.includes('validation') || errorMsg.includes('invalid')) {
      category = 'validation_errors';
    } else if (errorMsg.includes('permission') || errorMsg.includes('auth')) {
      category = 'permission_errors';
    } else if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
      category = 'duplicate_errors';
    } else if (errorMsg.includes('not found') || errorMsg.includes('missing')) {
      category = 'not_found_errors';
    }
    
    if (!classifications.has(category)) {
      classifications.set(category, {
        category,
        count: 0,
        items: [],
      });
    }
    
    const classification = classifications.get(category)!;
    classification.count++;
    classification.items.push({
      id: row.id,
      sourceType: row.source_type,
      error: errorMsg,
      lastAttempt: row.last_retry_at,
    });
  }
  
  return Array.from(classifications.values());
};

export const getExportSnapshot = (snapshotId: string): any => {
  const stmt = db.prepare('SELECT * FROM export_snapshots WHERE id = ?');
  const row = stmt.get(snapshotId);
  if (!row) return null;
  
  return {
    ...row,
    filters: safeJsonParse(row.filters, {}),
    frozen_snapshot: row.frozen_snapshot === 1,
  };
};

export const verifyExportConsistency = (snapshotId: string, exportRequest: ExportRequest): {
  consistent: boolean;
  message: string;
  details?: any;
} => {
  const snapshot = getExportSnapshot(snapshotId);
  if (!snapshot) {
    return { consistent: false, message: 'Snapshot not found' };
  }
  
  const currentExport = exportAuditData(exportRequest, 'system_verification');
  
  const isConsistent = snapshot.content_hash === hashContent(currentExport.content);
  
  return {
    consistent: isConsistent,
    message: isConsistent 
      ? 'Export content matches historical snapshot' 
      : 'Export content has changed since snapshot was created',
    details: {
      snapshotHash: snapshot.content_hash,
      currentHash: hashContent(currentExport.content),
      snapshotRecordCount: snapshot.record_count,
      currentRecordCount: currentExport.recordCount,
    },
  };
};

export const getDeadLetterExportSummary = (): any => {
  const query = `
    SELECT 
      dl.source_type,
      dl.original_error,
      COUNT(*) as count,
      MIN(dl.received_at) as first_received,
      MAX(dl.received_at) as last_received
    FROM dead_letters dl
    WHERE dl.resolved = 0
    GROUP BY dl.source_type, dl.original_error
    ORDER BY count DESC
  `;
  
  const rows = db.prepare(query).all();
  
  return {
    byError: rows,
    totalUnresolved: db.prepare('SELECT COUNT(*) as count FROM dead_letters WHERE resolved = 0').get().count,
  };
};
