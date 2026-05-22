import { v4 as uuidv4 } from 'uuid';
import {
  BorrowRecord,
  ReviewLog,
  ReviewAction,
  ReconciliationResult,
  BorrowStatus,
  Discrepancy,
  DiscrepancyType
} from '../types';
import { ReconciliationEngine } from './ReconciliationEngine';

export class ReviewService {
  private engine: ReconciliationEngine;
  private reviewLogs: ReviewLog[] = [];

  constructor(engine: ReconciliationEngine) {
    this.engine = engine;
  }

  reviewRecord(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    action: ReviewAction,
    comment: string,
    updates?: Partial<BorrowRecord>,
    resolveDiscrepancyTypes?: DiscrepancyType[]
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

    if (action === ReviewAction.APPROVED) {
      this.resolveAllRecordDiscrepancies(recordId);
    } else if (action === ReviewAction.MANUAL_CORRECTION && resolveDiscrepancyTypes) {
      this.resolveSpecificDiscrepancies(recordId, resolveDiscrepancyTypes);
    }

    const recordDiscrepancies = this.engine.getAllDiscrepancies()
      .filter(d => d.recordId === recordId);

    return {
      success: true,
      record,
      log,
      discrepancies: recordDiscrepancies
    };
  }

  manualCorrection(
    recordId: string,
    reviewerId: string,
    reviewerName: string,
    updates: Partial<BorrowRecord>,
    reason: string,
    resolveTypes?: DiscrepancyType[]
  ): {
    success: boolean;
    record: BorrowRecord;
    log: ReviewLog;
    recalculatedResult: ReconciliationResult;
  } {
    const autoResolveTypes = this.detectResolveTypes(updates);
    const typesToResolve = resolveTypes || autoResolveTypes;

    const result = this.reviewRecord(
      recordId,
      reviewerId,
      reviewerName,
      ReviewAction.MANUAL_CORRECTION,
      `人工修正: ${reason}`,
      updates,
      typesToResolve
    );

    const recalculatedResult = this.engine.runReconciliation();

    return {
      success: true,
      record: result.record!,
      log: result.log,
      recalculatedResult
    };
  }

  private detectResolveTypes(updates: Partial<BorrowRecord>): DiscrepancyType[] {
    const types: DiscrepancyType[] = [];

    if ('renewalCount' in updates) {
      types.push(DiscrepancyType.RENEWAL_LIMIT_EXCEEDED);
    }

    if ('dueDate' in updates || 'returnDate' in updates) {
      types.push(DiscrepancyType.OVERDUE);
    }

    if ('status' in updates && updates.status === BorrowStatus.RETURNED) {
      types.push(DiscrepancyType.OVERDUE);
      types.push(DiscrepancyType.RENEWAL_LIMIT_EXCEEDED);
    }

    return types;
  }

  private resolveSpecificDiscrepancies(recordId: string, types: DiscrepancyType[]): void {
    const discrepancies = this.engine.getAllDiscrepancies();
    discrepancies.forEach(d => {
      if (d.recordId === recordId && types.includes(d.type)) {
        this.engine.resolveDiscrepancy(d.discrepancyId);
      }
    });
  }

  private resolveAllRecordDiscrepancies(recordId: string): void {
    const discrepancies = this.engine.getAllDiscrepancies();
    discrepancies.forEach(d => {
      if (d.recordId === recordId) {
        this.engine.resolveDiscrepancy(d.discrepancyId);
      }
    });
  }

  getReviewLogs(recordId?: string): ReviewLog[] {
    if (recordId) {
      return this.reviewLogs.filter(log => log.recordId === recordId);
    }
    return [...this.reviewLogs];
  }

  recalculateReconciliation(): ReconciliationResult {
    return this.engine.runReconciliation();
  }

  approveDiscrepancy(
    discrepancyId: string,
    reviewerId: string,
    reviewerName: string,
    reason: string
  ): { success: boolean; discrepancy?: Discrepancy } {
    const discrepancy = this.engine.getDiscrepancy(discrepancyId);

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
    this.engine.resolveDiscrepancy(discrepancyId);

    const updatedDiscrepancy = this.engine.getDiscrepancy(discrepancyId);

    return { success: true, discrepancy: updatedDiscrepancy };
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
