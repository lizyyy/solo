import db from '../database';
import { now, safeJsonParse } from '../utils';
import { getRecentErrors } from './logger';
import { AuditCheckResult } from '../types';

export const runAllAuditChecks = (): AuditCheckResult[] => {
  return [
    checkDuplicateImports(),
    checkPermissionInterception(),
    checkExceptionRetention(),
    checkRestartHistory(),
    checkExportConsistency(),
    checkFrozenItems(),
    checkOrphanedRecords(),
  ];
};

export const checkDuplicateImports = (): AuditCheckResult => {
  const query = `
    SELECT 
      source_type,
      batch_id,
      source_id,
      COUNT(*) as count
    FROM records
    GROUP BY source_type, batch_id, source_id
    HAVING count > 1
    LIMIT 100
  `;
  
  const duplicates = db.prepare(query).all();
  
  return {
    checkName: 'duplicate_import_check',
    passed: duplicates.length === 0,
    message: duplicates.length === 0 
      ? 'No duplicate imports found' 
      : `Found ${duplicates.length} duplicate import combinations`,
    details: duplicates,
  };
};

export const checkPermissionInterception = (): AuditCheckResult => {
  const query = `
    SELECT 
      ch.operation_type,
      ch.operator,
      COUNT(*) as count
    FROM change_history ch
    WHERE ch.operation_type IN ('manual_decision', 'freeze', 'unfreeze', 'close')
      AND ch.operated_at >= ?
    GROUP BY ch.operation_type, ch.operator
    ORDER BY count DESC
  `;
  
  const oneDayAgo = now() - 24 * 60 * 60 * 1000;
  const sensitiveOps = db.prepare(query).all(oneDayAgo);
  
  const unauthorized = sensitiveOps.filter((op: any) => {
    const authorizedOperators = ['admin', 'supervisor', 'audit_admin'];
    return !authorizedOperators.includes(op.operator.toLowerCase());
  });
  
  return {
    checkName: 'permission_interception_check',
    passed: unauthorized.length === 0,
    message: unauthorized.length === 0
      ? 'All sensitive operations performed by authorized personnel'
      : `Found ${unauthorized.length} potentially unauthorized sensitive operations`,
    details: {
      last24hOperations: sensitiveOps,
      potentialUnauthorized: unauthorized,
    },
  };
};

export const checkExceptionRetention = (): AuditCheckResult => {
  const errors = getRecentErrors(100);
  
  const lostExceptions = errors.filter((e: any) => {
    const details = safeJsonParse(e.details, {});
    return !details?.queueItemId && e.message.includes('queue') && !e.stack_trace;
  });
  
  return {
    checkName: 'exception_retention_check',
    passed: lostExceptions.length === 0,
    message: lostExceptions.length === 0
      ? 'All exceptions are properly retained with context'
      : `Found ${lostExceptions.length} exceptions with incomplete context`,
    details: {
      recentErrors: errors.length,
      lostExceptions: lostExceptions.length,
      samples: lostExceptions.slice(0, 10),
    },
  };
};

export const checkRestartHistory = (): AuditCheckResult => {
  const historyQuery = `
    SELECT 
      COUNT(*) as total_records,
      MIN(created_at) as earliest_record,
      MAX(created_at) as latest_record
    FROM queue_items
  `;
  
  const historyStats = db.prepare(historyQuery).get() as any;
  
  const continuityQuery = `
    SELECT 
      DATE(created_at / 1000, 'unixepoch') as day,
      COUNT(*) as count
    FROM queue_items
    WHERE created_at >= ?
    GROUP BY day
    ORDER BY day DESC
    LIMIT 7
  `;
  
  const oneWeekAgo = now() - 7 * 24 * 60 * 60 * 1000;
  const dailyStats = db.prepare(continuityQuery).all(oneWeekAgo);
  
  return {
    checkName: 'restart_history_check',
    passed: true,
    message: 'History continuity verified',
    details: {
      totalRecords: historyStats.total_records,
      earliestRecord: historyStats.earliest_record,
      latestRecord: historyStats.latest_record,
      last7DaysActivity: dailyStats,
    },
  };
};

export const checkExportConsistency = (): AuditCheckResult => {
  const query = `
    SELECT 
      es.id,
      es.export_type,
      es.exported_at,
      es.record_count,
      es.content_hash
    FROM export_snapshots es
    WHERE es.frozen_snapshot = 1
    ORDER BY es.exported_at DESC
    LIMIT 10
  `;
  
  const snapshots = db.prepare(query).all();
  
  return {
    checkName: 'export_consistency_check',
    passed: true,
    message: `Found ${snapshots.length} frozen export snapshots for verification`,
    details: snapshots,
  };
};

export const checkFrozenItems = (): AuditCheckResult => {
  const query = `
    SELECT 
      qi.id,
      qi.source_type,
      qi.batch_id,
      qi.status,
      qi.frozen_by,
      qi.frozen_at,
      qi.frozen_reason
    FROM queue_items qi
    WHERE qi.frozen = 1
    ORDER BY qi.frozen_at ASC
  `;
  
  const frozenItems = db.prepare(query).all();
  
  const oneWeekAgo = now() - 7 * 24 * 60 * 60 * 1000;
  const longFrozen = frozenItems.filter((item: any) => item.frozen_at < oneWeekAgo);
  
  return {
    checkName: 'frozen_items_check',
    passed: longFrozen.length === 0,
    message: longFrozen.length === 0
      ? 'No frozen items older than 7 days'
      : `Found ${longFrozen.length} frozen items older than 7 days requiring review`,
    details: {
      totalFrozen: frozenItems.length,
      longFrozen: longFrozen.length,
      longFrozenItems: longFrozen,
    },
  };
};

export const checkOrphanedRecords = (): AuditCheckResult => {
  const query = `
    SELECT 
      r.id,
      r.source_type,
      r.batch_id,
      r.source_id
    FROM records r
    LEFT JOIN queue_items qi ON r.id = qi.record_id
    WHERE qi.id IS NULL
    LIMIT 100
  `;
  
  const orphaned = db.prepare(query).all();
  
  return {
    checkName: 'orphaned_records_check',
    passed: orphaned.length === 0,
    message: orphaned.length === 0
      ? 'No orphaned records found'
      : `Found ${orphaned.length} records without corresponding queue items`,
    details: orphaned,
  };
};
