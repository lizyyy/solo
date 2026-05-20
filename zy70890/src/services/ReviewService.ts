import { DataStore } from '../store/DataStore';
import {
  ReconciliationRecord,
  ReviewStatus,
  AttendanceStatus,
  DifferenceType,
  ReviewRequest,
  ManualCorrectionRequest
} from '../types';

export class ReviewService {
  private store: DataStore;

  constructor() {
    this.store = DataStore.getInstance();
  }

  batchReview(request: ReviewRequest): ReconciliationRecord[] {
    const updatedRecords: ReconciliationRecord[] = [];

    for (const recordId of request.recordIds) {
      const record = this.store.getReconciliationRecord(recordId);
      if (record) {
        record.reviewStatus = request.status;
        record.reviewComment = request.comment;
        record.reviewerId = request.operatorId;
        record.reviewerName = request.operatorName;
        record.reviewTime = this.store.now();
        this.store.updateReconciliationRecord(record);
        updatedRecords.push(record);
      }
    }

    return updatedRecords;
  }

  applyManualCorrection(request: ManualCorrectionRequest): ReconciliationRecord | null {
    const record = this.store.getReconciliationRecord(request.recordId);
    if (!record) {
      return null;
    }

    const oldStatus = record.finalStatus;
    const oldDifferences = [...record.differences];

    record.finalStatus = request.newStatus;
    record.isManualCorrected = true;
    record.correctionReason = request.reason;
    record.correctionOperatorId = request.operatorId;
    record.correctionOperatorName = request.operatorName;
    record.correctionTime = this.store.now();

    const manualDiff = record.differences.find(d => d.type === DifferenceType.MANUAL_CORRECTION);
    if (!manualDiff) {
      record.differences.push({
        type: DifferenceType.MANUAL_CORRECTION,
        description: `人工修正：状态从 ${this.getStatusText(oldStatus)} 改为 ${this.getStatusText(request.newStatus)}，原因：${request.reason}`,
        source: '人工复核',
        severity: 'low',
        evidence: `操作人: ${request.operatorName}`
      });
    }

    this.store.updateReconciliationRecord(record);
    return record;
  }

  private getStatusText(status: AttendanceStatus): string {
    const statusMap: Record<AttendanceStatus, string> = {
      [AttendanceStatus.NORMAL]: '正常',
      [AttendanceStatus.LATE]: '迟到',
      [AttendanceStatus.ABSENT]: '缺勤',
      [AttendanceStatus.LEAVE]: '请假',
      [AttendanceStatus.EXCEPTION]: '异常'
    };
    return statusMap[status] || status;
  }

  getReviewRecord(recordId: string): ReconciliationRecord | null {
    return this.store.getReconciliationRecord(recordId) || null;
  }

  getReconciliationRecords(reconciliationId: string): ReconciliationRecord[] {
    return this.store.getReconciliationRecordsByReconciliationId(reconciliationId);
  }

  getRecordsByReviewStatus(reconciliationId: string, status: ReviewStatus): ReconciliationRecord[] {
    return this.store
      .getReconciliationRecordsByReconciliationId(reconciliationId)
      .filter(r => r.reviewStatus === status);
  }

  getRecordsWithDifferences(reconciliationId: string): ReconciliationRecord[] {
    return this.store
      .getReconciliationRecordsByReconciliationId(reconciliationId)
      .filter(r => r.differences.length > 0);
  }

  getRecordsByPersonLevel(reconciliationId: string, level: any): ReconciliationRecord[] {
    return this.store
      .getReconciliationRecordsByReconciliationId(reconciliationId)
      .filter(r => r.personLevel === level);
  }

  getReviewSummary(reconciliationId: string): any {
    return this.store.getReconciliationSummary(reconciliationId);
  }
}
