import { db } from '../store/database';
import { RollbackRecord, RollbackStatus, RollbackFilter, PaginationParams, PaginatedResult } from '../types';
import { createObjectCsvStringifier } from 'csv-writer';

export class RollbackService {
  getRollbackRecords(
    filter: RollbackFilter,
    pagination: PaginationParams
  ): PaginatedResult<RollbackRecord> {
    return db.getRollbackRecords(filter, pagination);
  }

  getRollbackRecord(id: string): RollbackRecord | undefined {
    return db.getRollbackRecord(id);
  }

  getRollbackHistory(articleId: string): RollbackRecord[] {
    return db.getRollbackHistory(articleId);
  }

  updateRollbackStatus(
    recordId: string,
    status: RollbackStatus,
    operator: string,
    details?: { conflictDetails?: string; rejectReason?: string }
  ): RollbackRecord | null {
    const record = db.getRollbackRecord(recordId);
    if (!record) return null;

    const updateData: Partial<RollbackRecord> = {
      status,
      executedAt: new Date(),
      executedBy: operator
    };

    if (details?.conflictDetails) {
      updateData.conflictDetails = details.conflictDetails;
    }
    if (details?.rejectReason) {
      updateData.rejectReason = details.rejectReason;
    }

    return db.updateRollbackRecord(recordId, updateData) || null;
  }

  async exportToCSV(filter: RollbackFilter): Promise<string> {
    const records = db.getRollbackRecords(filter, { page: 1, pageSize: 10000 }).data;

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: '记录ID' },
        { id: 'articleId', title: '文章ID' },
        { id: 'articleTitle', title: '文章标题' },
        { id: 'fromVersion', title: '原版本' },
        { id: 'toVersion', title: '目标版本' },
        { id: 'requestedBy', title: '申请人' },
        { id: 'requestedAt', title: '申请时间' },
        { id: 'reason', title: '回滚原因' },
        { id: 'status', title: '状态' },
        { id: 'businessObject', title: '业务对象' },
        { id: 'executedBy', title: '执行人' },
        { id: 'executedAt', title: '执行时间' },
        { id: 'conflictDetails', title: '冲突详情' },
        { id: 'rejectReason', title: '驳回原因' }
      ]
    });

    const formattedRecords = records.map(r => ({
      ...r,
      requestedAt: r.requestedAt.toISOString(),
      executedAt: r.executedAt?.toISOString() || ''
    }));

    return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(formattedRecords);
  }

  createConflictRecord(
    articleId: string,
    articleTitle: string,
    fromVersion: number,
    toVersion: number,
    requestedBy: string,
    reason: string,
    businessObject: string,
    conflictDetails: string
  ): RollbackRecord {
    return db.createRollbackRecord({
      articleId,
      articleTitle,
      fromVersion,
      toVersion,
      requestedBy,
      reason,
      status: RollbackStatus.CONFLICT,
      businessObject,
      conflictDetails
    });
  }

  createRejectedRecord(
    articleId: string,
    articleTitle: string,
    fromVersion: number,
    toVersion: number,
    requestedBy: string,
    reason: string,
    businessObject: string,
    rejectReason: string
  ): RollbackRecord {
    return db.createRollbackRecord({
      articleId,
      articleTitle,
      fromVersion,
      toVersion,
      requestedBy,
      reason,
      status: RollbackStatus.REJECTED,
      businessObject,
      rejectReason
    });
  }

  createCompletedRecord(
    articleId: string,
    articleTitle: string,
    fromVersion: number,
    toVersion: number,
    requestedBy: string,
    reason: string,
    businessObject: string,
    executedBy: string
  ): RollbackRecord {
    return db.createRollbackRecord({
      articleId,
      articleTitle,
      fromVersion,
      toVersion,
      requestedBy,
      reason,
      status: RollbackStatus.COMPLETED,
      businessObject,
      executedAt: new Date(),
      executedBy
    });
  }
}

export const rollbackService = new RollbackService();
