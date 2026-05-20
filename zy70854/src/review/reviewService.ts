import { v4 as uuidv4 } from 'uuid';
import {
  MatchRecord,
  ReviewRecord,
  ItemStatus,
  ReviewAction,
  DifferenceType,
  PassengerLostItem,
  DriverTurnedInItem,
  WarehouseItem
} from '../types';

export class ReviewService {
  private reviewHistory: Map<string, ReviewRecord[]> = new Map();

  startReview(matchId: string, reviewer: string): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    if (match.status !== ItemStatus.MATCHED && match.status !== ItemStatus.UNMATCHED) {
      throw new Error('该记录状态不允许开始复核');
    }

    const previousStatus = match.status;
    match.status = ItemStatus.REVIEWING;
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.REQUEST_MORE_INFO,
      previousStatus,
      ItemStatus.REVIEWING,
      '开始人工复核',
      []
    );

    return match;
  }

  approveMatch(matchId: string, reviewer: string, reason: string): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    if (match.status !== ItemStatus.REVIEWING && match.status !== ItemStatus.MATCHED) {
      throw new Error('该记录状态不允许审批通过');
    }

    const previousStatus = match.status;
    match.status = ItemStatus.APPROVED;
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.APPROVE,
      previousStatus,
      ItemStatus.APPROVED,
      reason,
      []
    );

    return match;
  }

  rejectMatch(matchId: string, reviewer: string, reason: string): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    if (match.status !== ItemStatus.REVIEWING && match.status !== ItemStatus.MATCHED) {
      throw new Error('该记录状态不允许驳回');
    }

    const previousStatus = match.status;
    match.status = ItemStatus.REJECTED;
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.REJECT,
      previousStatus,
      ItemStatus.REJECTED,
      reason,
      []
    );

    return match;
  }

  manualMatch(
    matchId: string,
    reviewer: string,
    reason: string,
    targetIds: {
      passengerItemId?: string;
      driverItemId?: string;
      warehouseItemId?: string;
    }
  ): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    const previousStatus = match.status;
    const changes: { field: string; oldValue: string; newValue: string }[] = [];

    if (targetIds.passengerItemId && match.passengerItemId !== targetIds.passengerItemId) {
      changes.push({
        field: 'passengerItemId',
        oldValue: match.passengerItemId || '',
        newValue: targetIds.passengerItemId
      });
      match.passengerItemId = targetIds.passengerItemId;
    }

    if (targetIds.driverItemId && match.driverItemId !== targetIds.driverItemId) {
      changes.push({
        field: 'driverItemId',
        oldValue: match.driverItemId || '',
        newValue: targetIds.driverItemId
      });
      match.driverItemId = targetIds.driverItemId;
    }

    if (targetIds.warehouseItemId && match.warehouseItemId !== targetIds.warehouseItemId) {
      changes.push({
        field: 'warehouseItemId',
        oldValue: match.warehouseItemId || '',
        newValue: targetIds.warehouseItemId
      });
      match.warehouseItemId = targetIds.warehouseItemId;
    }

    match.status = ItemStatus.MATCHED;
    match.matchScore = 1;
    match.matchedFields = ['manual_match'];
    match.differences = match.differences.filter(d => d !== DifferenceType.DUPLICATE);
    match.differenceExplanations.push(`人工匹配: ${reason}`);
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.MANUAL_MATCH,
      previousStatus,
      ItemStatus.MATCHED,
      reason,
      changes
    );

    return match;
  }

  unmatch(
    matchId: string,
    reviewer: string,
    reason: string
  ): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    const previousStatus = match.status;
    match.status = ItemStatus.UNMATCHED;
    match.differenceExplanations.push(`解除匹配: ${reason}`);
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.UNMATCH,
      previousStatus,
      ItemStatus.UNMATCHED,
      reason,
      []
    );

    return match;
  }

  requestMoreInfo(
    matchId: string,
    reviewer: string,
    reason: string
  ): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    const previousStatus = match.status;
    match.status = ItemStatus.REVIEWING;
    match.differenceExplanations.push(`要求补充信息: ${reason}`);
    match.updatedAt = new Date().toISOString();

    this.addReviewRecord(
      matchId,
      reviewer,
      ReviewAction.REQUEST_MORE_INFO,
      previousStatus,
      ItemStatus.REVIEWING,
      reason,
      []
    );

    return match;
  }

  addDifferenceExplanation(
    matchId: string,
    reviewer: string,
    explanation: string,
    differenceType?: DifferenceType
  ): MatchRecord | null {
    const match = this.getMatchById(matchId);
    if (!match) return null;

    match.differenceExplanations.push(explanation);
    if (differenceType && !match.differences.includes(differenceType)) {
      match.differences.push(differenceType);
    }
    match.updatedAt = new Date().toISOString();

    return match;
  }

  getReviewHistory(matchId: string): ReviewRecord[] {
    return this.reviewHistory.get(matchId) || [];
  }

  getReviewRecordsByReviewer(reviewer: string): ReviewRecord[] {
    const allRecords: ReviewRecord[] = [];
    this.reviewHistory.forEach(records => {
      allRecords.push(...records.filter(r => r.reviewer === reviewer));
    });
    return allRecords;
  }

  getReviewRecordsByDateRange(startDate: string, endDate: string): ReviewRecord[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const allRecords: ReviewRecord[] = [];

    this.reviewHistory.forEach(records => {
      allRecords.push(...records.filter(r => {
        const reviewTime = new Date(r.reviewDate + ' ' + r.reviewTime).getTime();
        return reviewTime >= start && reviewTime <= end;
      }));
    });

    return allRecords;
  }

  private addReviewRecord(
    matchId: string,
    reviewer: string,
    action: ReviewAction,
    previousStatus: ItemStatus,
    newStatus: ItemStatus,
    reason: string,
    changes: { field: string; oldValue: string; newValue: string }[]
  ): void {
    const now = new Date();
    const reviewRecord: ReviewRecord = {
      id: uuidv4(),
      matchId,
      reviewer,
      reviewDate: now.toISOString().split('T')[0],
      reviewTime: now.toTimeString().split(' ')[0],
      action,
      previousStatus,
      newStatus,
      reason,
      changes
    };

    if (!this.reviewHistory.has(matchId)) {
      this.reviewHistory.set(matchId, []);
    }
    this.reviewHistory.get(matchId)!.push(reviewRecord);
  }

  private getMatchById(matchId: string): MatchRecord | null {
    return null;
  }

  getAuditTrail(matchId: string): string[] {
    const history = this.getReviewHistory(matchId);
    return history.map(record => {
      const actionText = this.getActionText(record.action);
      return `[${record.reviewDate} ${record.reviewTime}] ${record.reviewer} ${actionText} - ${record.reason}`;
    });
  }

  private getActionText(action: ReviewAction): string {
    const actionMap: Record<ReviewAction, string> = {
      [ReviewAction.APPROVE]: '审批通过',
      [ReviewAction.REJECT]: '驳回',
      [ReviewAction.REQUEST_MORE_INFO]: '要求补充信息',
      [ReviewAction.MANUAL_MATCH]: '人工匹配',
      [ReviewAction.UNMATCH]: '解除匹配'
    };
    return actionMap[action] || action;
  }

  validateMatchConsistency(
    match: MatchRecord,
    passengerItems: PassengerLostItem[],
    driverItems: DriverTurnedInItem[],
    warehouseItems: WarehouseItem[]
  ): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (match.passengerItemId) {
      const passenger = passengerItems.find(p => p.id === match.passengerItemId);
      if (!passenger) {
        issues.push('关联的乘客报失记录不存在');
      }
    }

    if (match.driverItemId) {
      const driver = driverItems.find(d => d.id === match.driverItemId);
      if (!driver) {
        issues.push('关联的司机上交记录不存在');
      }
    }

    if (match.warehouseItemId) {
      const warehouse = warehouseItems.find(w => w.id === match.warehouseItemId);
      if (!warehouse) {
        issues.push('关联的仓库入库记录不存在');
      }
    }

    if (!match.passengerItemId && !match.driverItemId && !match.warehouseItemId) {
      issues.push('匹配记录未关联任何来源记录');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
