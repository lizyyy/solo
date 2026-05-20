import {
  ReconciliationRecord,
  ReconciliationSummary,
  ReviewStatus,
  SampleStatus,
  Discrepancy,
  DiscrepancyType,
  generateId
} from './types';

export interface ReviewUpdate {
  recordId: string;
  newStatus?: SampleStatus;
  deductionAmount?: number;
  reviewNotes?: string;
  resolveDiscrepancy?: boolean;
}

export class ReviewService {
  private records: ReconciliationRecord[];
  private summary: ReconciliationSummary;

  constructor(initialRecords: ReconciliationRecord[]) {
    this.records = JSON.parse(JSON.stringify(initialRecords));
    this.summary = this.recalculateSummary();
  }

  getRecords(): ReconciliationRecord[] {
    return this.records;
  }

  getSummary(): ReconciliationSummary {
    return this.summary;
  }

  getPendingRecords(): ReconciliationRecord[] {
    return this.records.filter(r => r.reviewStatus === ReviewStatus.PENDING_REVIEW);
  }

  updateRecord(update: ReviewUpdate, reviewer: string): ReconciliationRecord {
    const recordIndex = this.records.findIndex(r => r.id === update.recordId);
    if (recordIndex === -1) {
      throw new Error(`Record not found: ${update.recordId}`);
    }

    const record = this.records[recordIndex];
    
    if (update.newStatus) {
      record.currentStatus = update.newStatus;
    }

    if (update.deductionAmount !== undefined) {
      record.deductionAmount = update.deductionAmount;
    }

    if (update.resolveDiscrepancy && record.discrepancy) {
      record.discrepancy.isResolved = true;
      record.discrepancy.resolution = update.reviewNotes || '人工复核后标记为已解决';
    }

    if (update.reviewNotes) {
      record.reviewNotes = update.reviewNotes;
    }

    record.reviewStatus = ReviewStatus.REVIEWED;
    record.reviewer = reviewer;
    record.reviewTime = new Date().toISOString();
    record.isModified = true;

    if (this.needsManualDiscrepancy(record, update)) {
      record.discrepancy = {
        id: generateId(),
        shipmentId: record.shipmentId,
        type: DiscrepancyType.MANUAL_CORRECTION,
        description: `人工修正：状态从${record.originalStatus}改为${record.currentStatus}`,
        amount: record.deductionAmount,
        source: `人工操作 - ${reviewer}`,
        isResolved: true
      };
    }

    this.summary = this.recalculateSummary();
    return record;
  }

  batchUpdate(updates: ReviewUpdate[], reviewer: string): ReconciliationRecord[] {
    return updates.map(update => this.updateRecord(update, reviewer));
  }

  confirmAllReviewed(): void {
    this.records.forEach(record => {
      if (record.reviewStatus === ReviewStatus.REVIEWED) {
        record.reviewStatus = ReviewStatus.CONFIRMED;
      }
    });
    this.summary = this.recalculateSummary();
  }

  private needsManualDiscrepancy(record: ReconciliationRecord, update: ReviewUpdate): boolean {
    if (!record.discrepancy && (update.newStatus || update.deductionAmount !== undefined)) {
      return true;
    }
    return false;
  }

  private recalculateSummary(): ReconciliationSummary {
    const summary: ReconciliationSummary = {
      totalShipments: this.records.length,
      returnedOnTime: 0,
      overdue: 0,
      damaged: 0,
      lost: 0,
      totalDeduction: 0,
      pendingReview: 0,
      reviewed: 0
    };

    this.records.forEach(record => {
      switch (record.currentStatus) {
        case SampleStatus.RETURNED:
          summary.returnedOnTime++;
          break;
        case SampleStatus.OVERDUE:
          summary.overdue++;
          break;
        case SampleStatus.DAMAGED:
          summary.damaged++;
          break;
        case SampleStatus.LOST:
          summary.lost++;
          break;
      }

      summary.totalDeduction += record.deductionAmount;

      if (record.reviewStatus === ReviewStatus.PENDING_REVIEW) {
        summary.pendingReview++;
      } else {
        summary.reviewed++;
      }
    });

    return summary;
  }

  getDiscrepancies(): Discrepancy[] {
    return this.records
      .filter(r => r.discrepancy)
      .map(r => r.discrepancy!);
  }

  getModifiedRecords(): ReconciliationRecord[] {
    return this.records.filter(r => r.isModified);
  }
}
