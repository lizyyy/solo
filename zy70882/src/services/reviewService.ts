import { v4 as uuidv4 } from 'uuid';
import { BillingRecord, ReviewStatus, ReviewNote } from '../types';
import { dataStore } from '../store/dataStore';
import { billingCalculatorService } from './billingCalculatorService';

export class ReviewService {
  async approveRecord(
    recordId: string,
    userId: string,
    userName: string,
    comment: string
  ): Promise<BillingRecord | undefined> {
    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'approve',
      comment,
    };

    const updatedRecord = dataStore.updateBillingRecord(recordId, {
      reviewStatus: ReviewStatus.APPROVED,
      reviewNotes: [...record.reviewNotes, reviewNote],
      anomalies: record.anomalies.map(a => ({ ...a, resolved: true })),
    });

    return updatedRecord;
  }

  async rejectRecord(
    recordId: string,
    userId: string,
    userName: string,
    comment: string
  ): Promise<BillingRecord | undefined> {
    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'reject',
      comment,
    };

    const updatedRecord = dataStore.updateBillingRecord(recordId, {
      reviewStatus: ReviewStatus.REJECTED,
      reviewNotes: [...record.reviewNotes, reviewNote],
    });

    return updatedRecord;
  }

  async requestMoreInfo(
    recordId: string,
    userId: string,
    userName: string,
    comment: string
  ): Promise<BillingRecord | undefined> {
    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'request_info',
      comment,
    };

    const updatedRecord = dataStore.updateBillingRecord(recordId, {
      reviewStatus: ReviewStatus.NEEDS_MORE_INFO,
      reviewNotes: [...record.reviewNotes, reviewNote],
    });

    return updatedRecord;
  }

  async modifyRecord(
    recordId: string,
    userId: string,
    userName: string,
    comment: string,
    modifications: Partial<BillingRecord>
  ): Promise<BillingRecord | undefined> {
    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const changes: Record<string, { old: any; new: any }> = {};
    const allowedFields = [
      'baseConsumption',
      'overtimeConsumption',
      'appliedMultiplier',
      'ratePerKwh',
      'electricityCost',
      'baseRent',
      'overtimeSurcharge',
      'totalAmount',
    ];

    for (const field of allowedFields) {
      if (field in modifications) {
        const oldValue = (record as any)[field];
        const newValue = (modifications as any)[field];
        if (oldValue !== newValue) {
          changes[field] = { old: oldValue, new: newValue };
        }
      }
    }

    if ('anomalies' in modifications && modifications.anomalies) {
      modifications.anomalies.forEach(anomaly => {
        const existingAnomaly = record.anomalies.find(a => a.id === anomaly.id);
        if (existingAnomaly && existingAnomaly.resolved !== anomaly.resolved) {
          changes[`anomaly_${anomaly.id}`] = {
            old: existingAnomaly.resolved,
            new: anomaly.resolved,
          };
        }
      });
    }

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'modify',
      comment,
      changes,
    };

    const updatedRecord = dataStore.updateBillingRecord(recordId, {
      ...modifications,
      reviewNotes: [...record.reviewNotes, reviewNote],
      updatedAt: new Date(),
    });

    return updatedRecord;
  }

  async addComment(
    recordId: string,
    userId: string,
    userName: string,
    comment: string
  ): Promise<BillingRecord | undefined> {
    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'comment',
      comment,
    };

    const updatedRecord = dataStore.updateBillingRecord(recordId, {
      reviewNotes: [...record.reviewNotes, reviewNote],
    });

    return updatedRecord;
  }

  async recalculateAndReview(
    recordId: string,
    userId: string,
    userName: string,
    comment: string
  ): Promise<BillingRecord | undefined> {
    const recalculated = await billingCalculatorService.recalculateRecord(recordId);
    if (!recalculated) return undefined;

    const record = dataStore.getBillingRecord(recordId);
    if (!record) return undefined;

    const reviewNote: ReviewNote = {
      id: uuidv4(),
      userId,
      userName,
      timestamp: new Date(),
      action: 'comment',
      comment: `重新计算: ${comment}`,
    };

    return dataStore.updateBillingRecord(recordId, {
      reviewNotes: [...record.reviewNotes, reviewNote],
    });
  }

  getReviewHistory(recordId: string): ReviewNote[] | undefined {
    const record = dataStore.getBillingRecord(recordId);
    return record?.reviewNotes;
  }

  getRecordsByStatus(status: ReviewStatus): BillingRecord[] {
    return dataStore.getAllBillingRecords().filter(r => r.reviewStatus === status);
  }

  getPendingRecords(): BillingRecord[] {
    return this.getRecordsByStatus(ReviewStatus.PENDING);
  }

  getApprovedRecords(): BillingRecord[] {
    return this.getRecordsByStatus(ReviewStatus.APPROVED);
  }

  getStatistics() {
    const records = dataStore.getAllBillingRecords();
    return {
      total: records.length,
      pending: records.filter(r => r.reviewStatus === ReviewStatus.PENDING).length,
      approved: records.filter(r => r.reviewStatus === ReviewStatus.APPROVED).length,
      rejected: records.filter(r => r.reviewStatus === ReviewStatus.REJECTED).length,
      needsMoreInfo: records.filter(r => r.reviewStatus === ReviewStatus.NEEDS_MORE_INFO).length,
      withAnomalies: records.filter(r => r.anomalies.length > 0).length,
      unresolvedAnomalies: records.filter(r => r.anomalies.some(a => !a.resolved)).length,
    };
  }
}

export const reviewService = new ReviewService();
