import { v4 as uuidv4 } from 'uuid';
import {
  BorrowRecord,
  ReviewLog,
  ReviewAction,
  ReconciliationResult,
  BorrowStatus,
  Discrepancy
} from '../types';
import { ReconciliationEngine } from './ReconciliationEngine';

export class ReviewService {
  private engine: ReconciliationEngine;
  private reviewLogs: ReviewLog[] = [];
  private resolvedDiscrepancies: Set<string> = new Set();

  constructor(engine: ReconciliationEngine) {
    this.engine = engine;
  }

  reviewRecord(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    action: ReviewAction,
    comment: string,
    updates?: Partial<BorrowRecord>
  ): {
    success: boolean;
    record?: BorrowRecord;
    log: ReviewLog;
    discrepancies: Discrepancy[];
  } {
    const record = this.engine.getBorrowRecord(recordId);
    if (!record) {
      throw new Error(`借阅记录不存在: ${recordId}`);
    }

    const previousStatus = record.status;
    let newStatus = previousStatus;

    if (updates) {
      Object.assign(record, updates);
      if (updates.status) {
        newStatus = updates.status;
      }
    }

    const log: ReviewLog = {
      logId: uuidv4(),
      recordId,
      reviewerId,
      reviewerName,
      action,
      comment,
      timestamp: new Date().toISOString(),
      previousStatus,
      newStatus
    };

    this.reviewLogs.push(log);

    if (action === ReviewAction.APPROVED || action === ReviewAction.MANUAL_CORRECTION) {
      this.resolveRecordDiscrepancies(recordId);
    }

    const newResult = this.engine.runReconciliation();

    return {
      success: true,
      record,
      log,
      discrepancies: newResult.discrepancies.filter(d => d.recordId === recordId)
    };
  }

  manualCorrection(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    updates: Partial<BorrowRecord>,
    reason: string
  ): {
    success: boolean;
    record: BorrowRecord;
    log: ReviewLog;
    recalculatedResult: ReconciliationResult;
  } {
    const result = this.reviewRecord(
      recordId,
      reviewerId,
      reviewerName,
      ReviewAction.MANUAL_CORRECTION,
      `人工修正: ${reason}`,
      updates
    );

    const recalculatedResult = this.engine.runReconciliation();

    return {
      success: true,
      record: result.record!,
      log: result.log,
      recalculatedResult
    };
  }

  private resolveRecordDiscrepancies(recordId: string): void {
    this.resolvedDiscrepancies.add(recordId);
  }

  getReviewLogs(recordId?: string): ReviewLog[] {
    if (recordId) {
      return this.reviewLogs.filter(log => log.recordId === recordId);
    }
    return [...this.reviewLogs];
  }

  recalculateReconciliation(): ReconciliationResult {
    const result = this.engine.runReconciliation();

    result.discrepancies = result.discrepancies.map(d => ({
      ...d,
      isResolved: this.resolvedDiscrepancies.has(d.recordId)
    }));

    result.reviewedRecords = [...this.resolvedDiscrepancies];

    return result;
  }

  approveDiscrepancy(
    discrepancyId: string,
    reviewerId: string,
    reviewerName: string,
    reason: string
  ): { success: boolean; discrepancy?: Discrepancy } {
    const result = this.engine.runReconciliation();
    const discrepancy = result.discrepancies.find(d => d.discrepancyId === discrepancyId);

    if (!discrepancy) {
      throw new Error(`差异记录不存在: ${discrepancyId}`);
    }

    const log: ReviewLog = {
      logId: uuidv4(),
      recordId: discrepancy.recordId,
      reviewerId,
      reviewerName,
      action: ReviewAction.APPROVED,
      comment: `批准例外: ${reason}`,
      timestamp: new Date().toISOString()
    };

    this.reviewLogs.push(log);
    this.resolvedDiscrepancies.add(discrepancy.recordId);
    discrepancy.isResolved = true;

    return { success: true, discrepancy };
  }

  rejectBorrow(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    reason: string
  ): { success: boolean; record?: BorrowRecord } {
    const result = this.reviewRecord(
      recordId,
      reviewerId,
      reviewerName,
      ReviewAction.REJECTED,
      `退回借阅: ${reason}`,
      { status: BorrowStatus.RETURNED }
    );

    return {
      success: true,
      record: result.record
    };
  }

  requestMoreInfo(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    infoRequest: string
  ): { success: boolean; log: ReviewLog } {
    const record = this.engine.getBorrowRecord(recordId);
    if (!record) {
      throw new Error(`借阅记录不存在: ${recordId}`);
    }

    const log: ReviewLog = {
      logId: uuidv4(),
      recordId,
      reviewerId,
      reviewerName,
      action: ReviewAction.NEEDS_MORE_INFO,
      comment: `需要补充材料: ${infoRequest}`,
      timestamp: new Date().toISOString()
    };

    this.reviewLogs.push(log);

    return { success: true, log };
  }

  getReviewSummary(): {
    totalReviewed: number;
    approved: number;
    rejected: number;
    needsInfo: number;
    manualCorrections: number;
  } {
    const logs = this.reviewLogs;
    return {
      totalReviewed: logs.length,
      approved: logs.filter(l => l.action === ReviewAction.APPROVED).length,
      rejected: logs.filter(l => l.action === ReviewAction.REJECTED).length,
      needsInfo: logs.filter(l => l.action === ReviewAction.NEEDS_MORE_INFO).length,
      manualCorrections: logs.filter(l => l.action === ReviewAction.MANUAL_CORRECTION).length
    };
  }
}
