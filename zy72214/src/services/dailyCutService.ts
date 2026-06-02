import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../store/dataStore';
import {
  CustodianConfirmation,
  ProcessingStatus,
  ExRightsDateReview,
  BalanceChange,
  ChangeType
} from '../types';

class DailyCutService {
  private generateId(): string {
    return uuidv4();
  }

  private getNow(): string {
    return new Date().toISOString();
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private updateConfirmationStatus(
    confirmationId: string,
    newStatus: ProcessingStatus,
    updatedBy: string,
    summary: string,
    updates: Partial<CustodianConfirmation> = {}
  ): boolean {
    const confirmation = dataStore.getConfirmation(confirmationId);
    if (!confirmation) return false;

    const beforeState = this.deepClone(confirmation);
    const oldStatus = confirmation.status;

    (confirmation as any).status = newStatus;
    Object.assign(confirmation, updates);

    const historyStore = dataStore as any;
    historyStore.createHistoryRecord(
      confirmationId,
      'CONFIRMATION',
      ChangeType.STATUS_CHANGE,
      updatedBy,
      beforeState,
      this.deepClone(confirmation),
      summary
    );

    return true;
  }

  public canReviewExRightsDate(confirmation: CustodianConfirmation): boolean {
    const validStatuses = [
      ProcessingStatus.IMPORTED,
      ProcessingStatus.APPROVER_VERIFIED
    ];
    return validStatuses.includes(confirmation.status);
  }

  public reviewExRightsDate(
    confirmationId: string,
    reviewedBy: string,
    screenshotReference: string,
    hasExRightsEvent: boolean,
    exRightsDate: string | null,
    impactDescription: string,
    adjustmentAmount: number = 0
  ): ExRightsDateReview | null {
    const confirmation = dataStore.getConfirmation(confirmationId);
    if (!confirmation) return null;
    if (!this.canReviewExRightsDate(confirmation)) return null;

    const review: ExRightsDateReview = {
      id: this.generateId(),
      confirmationId,
      reviewedBy,
      reviewedAt: this.getNow(),
      screenshotReference,
      hasExRightsEvent,
      exRightsDate,
      impactDescription,
      adjustmentAmount
    };

    dataStore.saveExRightsReview(review);

    this.updateConfirmationStatus(
      confirmationId,
      ProcessingStatus.EX_RIGHTS_DATE_REVIEWED,
      reviewedBy,
      `除权日审查完成 - 有除权事件: ${hasExRightsEvent}, 调整金额: ${adjustmentAmount}`,
      { exRightsDateReviewId: review.id } as Partial<CustodianConfirmation>
    );

    return review;
  }

  public canUpdateBalance(confirmation: CustodianConfirmation): boolean {
    return confirmation.status === ProcessingStatus.EX_RIGHTS_DATE_REVIEWED;
  }

  public updateBalance(
    confirmationId: string,
    updatedBy: string,
    previousBalance: number,
    effectiveDate: string
  ): BalanceChange | null {
    const confirmation = dataStore.getConfirmation(confirmationId);
    if (!confirmation) return null;
    if (!this.canUpdateBalance(confirmation)) return null;

    let adjustmentAmount = 0;

    if (confirmation.exRightsDateReviewId) {
      const review = dataStore.getExRightsReview(confirmation.exRightsDateReviewId);
      if (review) {
        adjustmentAmount = review.adjustmentAmount;
      }
    }

    const interestAmount = confirmation.interestAmount;
    const newBalance = previousBalance + interestAmount + adjustmentAmount;

    const balanceChange: BalanceChange = {
      id: this.generateId(),
      confirmationId,
      updatedAt: this.getNow(),
      updatedBy,
      previousBalance,
      newBalance,
      interestAmount,
      adjustmentAmount,
      effectiveDate
    };

    dataStore.saveBalanceChange(balanceChange);

    this.updateConfirmationStatus(
      confirmationId,
      ProcessingStatus.BALANCE_UPDATED,
      updatedBy,
      `余额更新完成 - 原余额: ${previousBalance}, 新余额: ${newBalance}`,
      { balanceUpdateId: balanceChange.id } as Partial<CustodianConfirmation>
    );

    return balanceChange;
  }

  public processFullWorkflow(
    confirmationId: string,
    operator: string,
    screenshotReference: string,
    hasExRightsEvent: boolean,
    exRightsDate: string | null,
    impactDescription: string,
    previousBalance: number,
    effectiveDate: string
  ): {
    exRightsReview: ExRightsDateReview | null;
    balanceChange: BalanceChange | null;
    completed: boolean;
  } {
    const confirmation = dataStore.getConfirmation(confirmationId);
    if (!confirmation) {
      return { exRightsReview: null, balanceChange: null, completed: false };
    }

    if (confirmation.isPinyinApprover && confirmation.status === ProcessingStatus.PENDING_APPROVER_VERIFICATION) {
      return { exRightsReview: null, balanceChange: null, completed: false };
    }

    const exRightsReview = this.reviewExRightsDate(
      confirmationId,
      operator,
      screenshotReference,
      hasExRightsEvent,
      exRightsDate,
      impactDescription
    );

    if (!exRightsReview) {
      return { exRightsReview: null, balanceChange: null, completed: false };
    }

    const balanceChange = this.updateBalance(
      confirmationId,
      operator,
      previousBalance,
      effectiveDate
    );

    return {
      exRightsReview,
      balanceChange,
      completed: !!balanceChange
    };
  }

  public getStatistics() {
    const allConfirmations = dataStore.getAllConfirmations();
    const stats = {
      total: allConfirmations.length,
      byStatus: {} as Record<ProcessingStatus, number>,
      pinyinApproverCount: 0,
      withManualModifications: 0
    };

    Object.values(ProcessingStatus).forEach(status => {
      (stats.byStatus as any)[status] = 0;
    });

    for (const conf of allConfirmations) {
      stats.byStatus[conf.status]++;
      if (conf.isPinyinApprover) stats.pinyinApproverCount++;
      if (conf.manualModifications.length > 0) stats.withManualModifications++;
    }

    return stats;
  }

  public getEvidenceForCustomerManager(confirmationId: string): {
    originalRowNumber: number;
    rawContent: string;
    manualModifications: any[];
    status: ProcessingStatus;
    statusFlow: any[];
    history: any[];
    exRightsReview: ExRightsDateReview | null;
    balanceChange: BalanceChange | null;
  } | null {
    const confirmation = dataStore.getConfirmation(confirmationId);
    if (!confirmation) return null;

    const history = dataStore.getHistory(confirmationId);
    const statusFlow = dataStore.getStatusFlow(confirmationId);

    let exRightsReview: ExRightsDateReview | null = null;
    if (confirmation.exRightsDateReviewId) {
      exRightsReview = dataStore.getExRightsReview(confirmation.exRightsDateReviewId) || null;
    }

    let balanceChange: BalanceChange | null = null;
    if (confirmation.balanceUpdateId) {
      balanceChange = dataStore.getBalanceChange(confirmation.balanceUpdateId) || null;
    }

    return {
      originalRowNumber: confirmation.originalRowNumber,
      rawContent: confirmation.rawContent,
      manualModifications: confirmation.manualModifications,
      status: confirmation.status,
      statusFlow,
      history: history.map(h => ({
        changeType: h.changeType,
        changedBy: h.changedBy,
        changedAt: h.changedAt,
        diffSummary: h.diffSummary
      })),
      exRightsReview,
      balanceChange
    };
  }
}

export const dailyCutService = new DailyCutService();
