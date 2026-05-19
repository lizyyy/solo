import { db } from '../models/database';
import { UserContext, QualityRecord, ReworkRecord, BadRecord, ImportHistory } from '../models/types';

export interface ReviewResult {
  qualityRecords: QualityRecord[];
  reworkRecords: ReworkRecord[];
  badRecords: BadRecord[];
  importHistories: ImportHistory[];
  statistics: {
    totalQualityRecords: number;
    totalReworkRecords: number;
    pendingBadRecords: number;
    resolvedBadRecords: number;
  };
}

export interface BatchReviewResult {
  batchId: string;
  qualityRecord?: QualityRecord;
  reworkRecords: ReworkRecord[];
}

export function reviewAll(userContext: UserContext): ReviewResult {
  const qualityRecords = db.qualityRecords.findAll();
  const reworkRecords = db.reworkRecords.findAll();
  const badRecords = db.badRecords.findAll();
  const importHistories = db.importHistories.findAll();

  db.auditLogs.create({
    action: 'REVIEW',
    entityType: 'AllData',
    operator: userContext.operator,
    role: userContext.role,
    details: {
      qualityRecordsCount: qualityRecords.length,
      reworkRecordsCount: reworkRecords.length,
      badRecordsCount: badRecords.length,
    },
  });

  return {
    qualityRecords,
    reworkRecords,
    badRecords,
    importHistories,
    statistics: {
      totalQualityRecords: qualityRecords.length,
      totalReworkRecords: reworkRecords.length,
      pendingBadRecords: badRecords.filter(b => !b.isResolved).length,
      resolvedBadRecords: badRecords.filter(b => b.isResolved).length,
    },
  };
}

export function reviewByBatchId(batchId: string, userContext: UserContext): BatchReviewResult {
  const qualityRecord = db.qualityRecords.findByBatchId(batchId);
  const reworkRecords = db.reworkRecords.findByBatchId(batchId);

  db.auditLogs.create({
    action: 'REVIEW',
    entityType: 'Batch',
    operator: userContext.operator,
    role: userContext.role,
    details: { batchId },
  });

  return {
    batchId,
    qualityRecord,
    reworkRecords,
  };
}

export function resolveBadRecord(badRecordId: string, userContext: UserContext): BadRecord | null {
  const result = db.badRecords.resolve(badRecordId, userContext.operator);

  if (result) {
    db.auditLogs.create({
      action: 'RESOLVE',
      entityType: 'BadRecord',
      entityId: badRecordId,
      operator: userContext.operator,
      role: userContext.role,
      details: {},
    });
  }

  return result;
}
