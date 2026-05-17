import { v4 as uuidv4 } from 'uuid';
import { RefundReview, AuditLog, ConflictRecord, ImportBadRow, RefundReviewStatus } from '../types';

class DataStore {
  private refundReviews: Map<string, RefundReview> = new Map();
  private auditLogs: Map<string, AuditLog> = new Map();
  private conflictRecords: Map<string, ConflictRecord> = new Map();
  private importBadRows: Map<string, ImportBadRow> = new Map();
  private idempotentKeys: Set<string> = new Set();

  saveRefundReview(review: RefundReview): RefundReview {
    this.refundReviews.set(review.id, { ...review, updateTime: new Date().toISOString() });
    return this.refundReviews.get(review.id)!;
  }

  getRefundReview(id: string): RefundReview | undefined {
    return this.refundReviews.get(id);
  }

  listRefundReviews(
    page: number,
    pageSize: number,
    filters?: {
      status?: RefundReviewStatus;
      userId?: string;
      orderNo?: string;
    }
  ): { list: RefundReview[]; total: number } {
    let list = Array.from(this.refundReviews.values());
    
    if (filters) {
      if (filters.status) {
        list = list.filter(item => item.status === filters.status);
      }
      if (filters.userId) {
        list = list.filter(item => item.orderInfo.userId === filters.userId);
      }
      if (filters.orderNo) {
        list = list.filter(item => item.orderInfo.orderNo.includes(filters.orderNo!));
      }
    }

    list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      list: list.slice(start, end),
      total: list.length
    };
  }

  checkIdempotentKey(key: string): boolean {
    return this.idempotentKeys.has(key);
  }

  addIdempotentKey(key: string): void {
    this.idempotentKeys.add(key);
  }

  saveAuditLog(log: Omit<AuditLog, 'id'>): AuditLog {
    const auditLog: AuditLog = {
      ...log,
      id: uuidv4()
    };
    this.auditLogs.set(auditLog.id, auditLog);
    return auditLog;
  }

  listAuditLogs(refundReviewId: string): AuditLog[] {
    return Array.from(this.auditLogs.values())
      .filter(log => log.refundReviewId === refundReviewId)
      .sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
  }

  saveConflictRecord(record: Omit<ConflictRecord, 'id'>): ConflictRecord {
    const conflictRecord: ConflictRecord = {
      ...record,
      id: uuidv4()
    };
    this.conflictRecords.set(conflictRecord.id, conflictRecord);
    return conflictRecord;
  }

  listConflictRecords(refundReviewId?: string): ConflictRecord[] {
    let list = Array.from(this.conflictRecords.values());
    if (refundReviewId) {
      list = list.filter(r => r.refundReviewId === refundReviewId);
    }
    return list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
  }

  saveImportBadRow(row: Omit<ImportBadRow, 'id'>): ImportBadRow {
    const badRow: ImportBadRow = {
      ...row,
      id: uuidv4()
    };
    this.importBadRows.set(badRow.id, badRow);
    return badRow;
  }

  listImportBadRows(batchId?: string): ImportBadRow[] {
    let list = Array.from(this.importBadRows.values());
    if (batchId) {
      list = list.filter(r => r.importBatchId === batchId);
    }
    return list.sort((a, b) => a.rowNumber - b.rowNumber);
  }

  getSplitOrderGroupReviews(groupId: string): RefundReview[] {
    return Array.from(this.refundReviews.values())
      .filter(r => r.splitOrderGroupId === groupId);
  }
}

export const dataStore = new DataStore();
