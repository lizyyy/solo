import { v4 as uuidv4 } from 'uuid';
import {
  CustodianConfirmation,
  CustodianConfirmationRaw,
  ExRightsDateReview,
  BalanceChange,
  HistoryRecord,
  ProcessingStatus,
  ChangeType,
  ImportResult,
  ManualModification,
  RollbackResult
} from '../types';
import { isPinyinName, normalizeApproverName } from '../utils/pinyinDetector';

class DataStore {
  private confirmations: Map<string, CustodianConfirmation> = new Map();
  private exRightsReviews: Map<string, ExRightsDateReview> = new Map();
  private balanceChanges: Map<string, BalanceChange> = new Map();
  private historyRecords: HistoryRecord[] = [];

  private generateId(): string {
    return uuidv4();
  }

  private getNow(): string {
    return new Date().toISOString();
  }

  private createHistoryRecord(
    entityId: string,
    entityType: 'CONFIRMATION' | 'BALANCE_CHANGE' | 'EX_RIGHTS_REVIEW',
    changeType: ChangeType,
    changedBy: string,
    beforeState: any,
    afterState: any,
    diffSummary: string
  ): void {
    const record: HistoryRecord = {
      id: this.generateId(),
      entityId,
      entityType,
      changeType,
      changedBy,
      changedAt: this.getNow(),
      beforeState,
      afterState,
      diffSummary
    };
    this.historyRecords.push(record);
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  private generateUniqueKey(raw: CustodianConfirmationRaw): string {
    return `${raw.importBatchId}-${raw.originalRowNumber}-${raw.clientAccount}-${raw.interestAmount}`;
  }

  private isDuplicate(raw: CustodianConfirmationRaw): boolean {
    const key = this.generateUniqueKey(raw);
    for (const conf of this.confirmations.values()) {
      const existingKey = `${conf.importBatchId}-${conf.originalRowNumber}-${conf.clientAccount}-${conf.interestAmount}`;
      if (existingKey === key) return true;
    }
    return false;
  }

  public importConfirmations(
    rawConfirmations: CustodianConfirmationRaw[],
    importedBy: string
  ): ImportResult {
    const result: ImportResult = {
      successCount: 0,
      duplicateCount: 0,
      pinyinApproverCount: 0,
      importedIds: [],
      duplicateRowNumbers: []
    };

    for (const raw of rawConfirmations) {
      if (this.isDuplicate(raw)) {
        result.duplicateCount++;
        result.duplicateRowNumbers.push(raw.originalRowNumber);
        continue;
      }

      const normalizedApprover = normalizeApproverName(raw.approverName);
      const isPinyin = isPinyinName(normalizedApprover);

      const confirmation: CustodianConfirmation = {
        id: this.generateId(),
        originalRowNumber: raw.originalRowNumber,
        importBatchId: raw.importBatchId,
        importedAt: this.getNow(),
        importedBy,
        clientAccount: raw.clientAccount,
        interestAmount: raw.interestAmount,
        approverName: normalizedApprover,
        approvalDate: raw.approvalDate,
        rawContent: raw.rawContent,
        remark: '',
        status: isPinyin
          ? ProcessingStatus.PENDING_APPROVER_VERIFICATION
          : ProcessingStatus.IMPORTED,
        manualModifications: [],
        isPinyinApprover: isPinyin,
        currentAssignee: isPinyin ? '客户经理' : null,
        balanceUpdateId: null,
        exRightsDateReviewId: null
      };

      this.confirmations.set(confirmation.id, confirmation);
      this.createHistoryRecord(
        confirmation.id,
        'CONFIRMATION',
        ChangeType.CREATE,
        importedBy,
        null,
        this.deepClone(confirmation),
        `导入托管确认页 - 行号: ${raw.originalRowNumber}, 客户: ${raw.clientAccount}`
      );

      result.successCount++;
      result.importedIds.push(confirmation.id);
      if (isPinyin) result.pinyinApproverCount++;
    }

    return result;
  }

  public getConfirmation(id: string): CustodianConfirmation | undefined {
    return this.confirmations.get(id);
  }

  public getAllConfirmations(): CustodianConfirmation[] {
    return Array.from(this.confirmations.values());
  }

  public getConfirmationsByStatus(status: ProcessingStatus): CustodianConfirmation[] {
    return this.getAllConfirmations().filter(c => c.status === status);
  }

  public updateRemark(
    confirmationId: string,
    newRemark: string,
    modifiedBy: string,
    reason: string
  ): boolean {
    const confirmation = this.confirmations.get(confirmationId);
    if (!confirmation) return false;

    const beforeState = this.deepClone(confirmation);
    const oldRemark = confirmation.remark;

    const modification: ManualModification = {
      fieldName: 'remark',
      oldValue: oldRemark,
      newValue: newRemark,
      modifiedBy,
      modifiedAt: this.getNow(),
      reason
    };

    confirmation.remark = newRemark;
    confirmation.manualModifications.push(modification);

    this.createHistoryRecord(
      confirmationId,
      'CONFIRMATION',
      ChangeType.UPDATE,
      modifiedBy,
      beforeState,
      this.deepClone(confirmation),
      `修改备注: "${oldRemark}" → "${newRemark}"`
    );

    return true;
  }

  public verifyApproverName(
    confirmationId: string,
    verifiedName: string,
    verifiedBy: string
  ): boolean {
    const confirmation = this.confirmations.get(confirmationId);
    if (!confirmation) return false;
    if (confirmation.status !== ProcessingStatus.PENDING_APPROVER_VERIFICATION) return false;

    const beforeState = this.deepClone(confirmation);
    const oldName = confirmation.approverName;

    const modification: ManualModification = {
      fieldName: 'approverName',
      oldValue: oldName,
      newValue: verifiedName,
      modifiedBy: verifiedBy,
      modifiedAt: this.getNow(),
      reason: '客户经理复核审批人拼音'
    };

    confirmation.approverName = verifiedName;
    confirmation.isPinyinApprover = false;
    confirmation.status = ProcessingStatus.APPROVER_VERIFIED;
    confirmation.currentAssignee = null;
    confirmation.manualModifications.push(modification);

    this.createHistoryRecord(
      confirmationId,
      'CONFIRMATION',
      ChangeType.STATUS_CHANGE,
      verifiedBy,
      beforeState,
      this.deepClone(confirmation),
      `审批人复核完成: "${oldName}" → "${verifiedName}", 状态变更为已复核`
    );

    return true;
  }

  public updateConfirmationField(
    confirmationId: string,
    fieldName: keyof CustodianConfirmation,
    newValue: string | number,
    modifiedBy: string,
    reason: string
  ): boolean {
    const confirmation = this.confirmations.get(confirmationId);
    if (!confirmation) return false;

    const beforeState = this.deepClone(confirmation);
    const oldValue = String(confirmation[fieldName]);

    const modification: ManualModification = {
      fieldName: String(fieldName),
      oldValue,
      newValue: String(newValue),
      modifiedBy,
      modifiedAt: this.getNow(),
      reason
    };

    (confirmation[fieldName] as string | number) = newValue;
    confirmation.manualModifications.push(modification);

    this.createHistoryRecord(
      confirmationId,
      'CONFIRMATION',
      ChangeType.UPDATE,
      modifiedBy,
      beforeState,
      this.deepClone(confirmation),
      `修改字段[${fieldName}]: "${oldValue}" → "${newValue}"`
    );

    return true;
  }

  public getHistory(entityId: string): HistoryRecord[] {
    return this.historyRecords.filter(r => r.entityId === entityId);
  }

  public getAllHistory(): HistoryRecord[] {
    return [...this.historyRecords];
  }

  public getStatusFlow(confirmationId: string): Array<{ status: ProcessingStatus; time: string; operator: string }> {
    const history = this.getHistory(confirmationId);
    const flow: Array<{ status: ProcessingStatus; time: string; operator: string }> = [];

    for (const record of history) {
      if (record.changeType === ChangeType.CREATE && record.afterState) {
        flow.push({
          status: (record.afterState as unknown as CustodianConfirmation).status,
          time: record.changedAt,
          operator: record.changedBy
        });
      } else if (record.changeType === ChangeType.STATUS_CHANGE && record.afterState) {
        flow.push({
          status: (record.afterState as unknown as CustodianConfirmation).status,
          time: record.changedAt,
          operator: record.changedBy
        });
      }
    }

    return flow;
  }

  public saveExRightsReview(review: ExRightsDateReview): void {
    this.exRightsReviews.set(review.id, review);
  }

  public getExRightsReview(id: string): ExRightsDateReview | undefined {
    return this.exRightsReviews.get(id);
  }

  public getAllExRightsReviews(): ExRightsDateReview[] {
    return Array.from(this.exRightsReviews.values());
  }

  public deleteExRightsReview(id: string): boolean {
    return this.exRightsReviews.delete(id);
  }

  public saveBalanceChange(balanceChange: BalanceChange): void {
    this.balanceChanges.set(balanceChange.id, balanceChange);
  }

  public getBalanceChange(id: string): BalanceChange | undefined {
    return this.balanceChanges.get(id);
  }

  public getAllBalanceChanges(): BalanceChange[] {
    return Array.from(this.balanceChanges.values());
  }

  public deleteBalanceChange(id: string): boolean {
    return this.balanceChanges.delete(id);
  }

  public rollbackToStatus(
    confirmationId: string,
    targetStatus: ProcessingStatus,
    rolledBackBy: string,
    reason: string
  ): RollbackResult {
    const confirmation = this.confirmations.get(confirmationId);
    if (!confirmation) {
      return { success: false, rollbackedStatus: targetStatus, message: '确认记录不存在' };
    }

    const beforeState = this.deepClone(confirmation);
    const currentStatus = confirmation.status;

    const statusOrder: ProcessingStatus[] = [
      ProcessingStatus.IMPORTED,
      ProcessingStatus.PENDING_APPROVER_VERIFICATION,
      ProcessingStatus.APPROVER_VERIFIED,
      ProcessingStatus.EX_RIGHTS_DATE_REVIEWED,
      ProcessingStatus.BALANCE_UPDATED
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);
    const targetIndex = statusOrder.indexOf(targetStatus);

    if (targetIndex >= currentIndex) {
      return {
        success: false,
        rollbackedStatus: currentStatus,
        message: '目标状态必须早于当前状态才能回滚'
      };
    }

    const exRightsIndex = statusOrder.indexOf(ProcessingStatus.EX_RIGHTS_DATE_REVIEWED);
    const balanceIndex = statusOrder.indexOf(ProcessingStatus.BALANCE_UPDATED);

    if (targetIndex < balanceIndex && confirmation.balanceUpdateId) {
      this.balanceChanges.delete(confirmation.balanceUpdateId);
      confirmation.balanceUpdateId = null;
    }

    if (targetIndex < exRightsIndex && confirmation.exRightsDateReviewId) {
      this.exRightsReviews.delete(confirmation.exRightsDateReviewId);
      confirmation.exRightsDateReviewId = null;
    }

    confirmation.status = targetStatus;

    this.createHistoryRecord(
      confirmationId,
      'CONFIRMATION',
      ChangeType.ROLLBACK,
      rolledBackBy,
      beforeState,
      this.deepClone(confirmation),
      `回滚操作: ${currentStatus} → ${targetStatus}, 原因: ${reason}`
    );

    return {
      success: true,
      rollbackedStatus: targetStatus,
      message: `成功回滚到 ${targetStatus}`
    };
  }
}

export const dataStore = new DataStore();
