import { v4 as uuidv4 } from 'uuid';
import {
  Case,
  BorrowRecord,
  UserPermission,
  Discrepancy,
  ReconciliationResult,
  DiscrepancyType,
  ClassificationLevel,
  BorrowStatus
} from '../types';

export class ReconciliationEngine {
  private cases: Map<string, Case> = new Map();
  private borrowRecords: Map<string, BorrowRecord> = new Map();
  private userPermissions: Map<string, UserPermission> = new Map();
  private discrepancies: Discrepancy[] = [];
  private reviewedRecords: Set<string> = new Set();

  loadData(cases: Case[], borrowRecords: BorrowRecord[], permissions: UserPermission[]): void {
    this.cases.clear();
    this.borrowRecords.clear();
    this.userPermissions.clear();
    this.discrepancies = [];
    this.reviewedRecords.clear();

    cases.forEach(c => this.cases.set(c.caseId, c));
    borrowRecords.forEach(r => this.borrowRecords.set(r.recordId, r));
    permissions.forEach(p => this.userPermissions.set(p.userId, p));
  }

  runReconciliation(): ReconciliationResult {
    this.discrepancies = [];
    this.reviewedRecords.clear();

    for (const record of this.borrowRecords.values()) {
      this.checkRecord(record);
    }

    const summary = this.calculateSummary();

    return {
      reconciliationId: uuidv4(),
      createdAt: new Date().toISOString(),
      totalRecords: this.borrowRecords.size,
      matchedRecords: this.borrowRecords.size - this.discrepancies.length,
      discrepancyCount: this.discrepancies.length,
      discrepancies: [...this.discrepancies],
      reviewedRecords: [...this.reviewedRecords],
      summary
    };
  }

  private checkRecord(record: BorrowRecord): void {
    const caseInfo = this.cases.get(record.caseId);
    const userPermission = this.userPermissions.get(record.borrowerId);

    this.checkOverdue(record);
    this.checkClassification(record, caseInfo, userPermission);
    this.checkRenewalLimit(record, userPermission);
    this.checkPermission(record, userPermission);
  }

  private checkOverdue(record: BorrowRecord): void {
    if (record.status === BorrowStatus.RETURNED) return;

    const today = new Date();
    const dueDate = new Date(record.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 0) {
      this.addDiscrepancy({
        type: DiscrepancyType.OVERDUE,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low',
        description: `借阅超期 ${daysOverdue} 天`,
        explanation: `应还日期: ${record.dueDate}, 当前日期: ${today.toISOString().split('T')[0]}。借阅人: ${record.borrowerName}，请立即联系催还。`
      });
    }
  }

  private checkClassification(
    record: BorrowRecord,
    caseInfo?: Case,
    userPermission?: UserPermission
  ): void {
    if (!caseInfo || !userPermission) return;

    const classificationLevel = {
      [ClassificationLevel.PUBLIC]: 0,
      [ClassificationLevel.INTERNAL]: 1,
      [ClassificationLevel.CONFIDENTIAL]: 2,
      [ClassificationLevel.TOP_SECRET]: 3
    };

    const caseLevel = classificationLevel[caseInfo.classification];
    const maxAllowedLevel = Math.max(...userPermission.allowedClassifications.map(c => classificationLevel[c]));

    if (caseLevel > maxAllowedLevel) {
      this.addDiscrepancy({
        type: DiscrepancyType.CLASSIFICATION_MISMATCH,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: caseLevel >= 2 ? 'high' : 'medium',
        description: `密级权限不匹配: 案件为${this.getClassificationName(caseInfo.classification)}`,
        explanation: `案件【${caseInfo.title}】密级为${this.getClassificationName(caseInfo.classification)}，但用户【${userPermission.userName}】仅有权限访问: ${userPermission.allowedClassifications.map(c => this.getClassificationName(c)).join('、')}。此借阅需立即复核。`
      });
    }
  }

  private checkRenewalLimit(record: BorrowRecord, userPermission?: UserPermission): void {
    if (!userPermission) return;

    if (record.renewalCount > userPermission.maxRenewals) {
      this.addDiscrepancy({
        type: DiscrepancyType.RENEWAL_LIMIT_EXCEEDED,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: 'medium',
        description: `续借次数超限: ${record.renewalCount}次`,
        explanation: `用户【${userPermission.userName}】最大续借次数为${userPermission.maxRenewals}次，当前已续借${record.renewalCount}次，超出${record.renewalCount - userPermission.maxRenewals}次。需核实审批记录。`
      });
    }
  }

  private checkPermission(record: BorrowRecord, userPermission?: UserPermission): void {
    if (!userPermission) {
      this.addDiscrepancy({
        type: DiscrepancyType.PERMISSION_DENIED,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: 'high',
        description: '用户权限记录不存在',
        explanation: `借阅人【${record.borrowerName}】ID: ${record.borrowerId} 在人员权限表中无记录。此借阅可能未经授权，需立即核实。`
      });
      return;
    }

    if (!userPermission.isActive) {
      this.addDiscrepancy({
        type: DiscrepancyType.PERMISSION_DENIED,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: 'high',
        description: '用户账号已停用',
        explanation: `用户【${userPermission.userName}】账号状态为已停用，不应继续持有卷宗。请立即联系归还。`
      });
    }
  }

  private addDiscrepancy(discrepancy: Omit<Discrepancy, 'discrepancyId' | 'isResolved'>): void {
    this.discrepancies.push({
      ...discrepancy,
      discrepancyId: uuidv4(),
      isResolved: false
    });
  }

  private calculateSummary(): ReconciliationResult['summary'] {
    return {
      overdue: this.discrepancies.filter(d => d.type === DiscrepancyType.OVERDUE).length,
      classificationIssues: this.discrepancies.filter(d => d.type === DiscrepancyType.CLASSIFICATION_MISMATCH).length,
      renewalIssues: this.discrepancies.filter(d => d.type === DiscrepancyType.RENEWAL_LIMIT_EXCEEDED).length,
      permissionIssues: this.discrepancies.filter(d => d.type === DiscrepancyType.PERMISSION_DENIED).length
    };
  }

  private getClassificationName(classification: ClassificationLevel): string {
    const names: Record<ClassificationLevel, string> = {
      [ClassificationLevel.PUBLIC]: '公开',
      [ClassificationLevel.INTERNAL]: '内部',
      [ClassificationLevel.CONFIDENTIAL]: '机密',
      [ClassificationLevel.TOP_SECRET]: '绝密'
    };
    return names[classification];
  }

  getCaseInfo(caseId: string): Case | undefined {
    return this.cases.get(caseId);
  }

  getUserPermission(userId: string): UserPermission | undefined {
    return this.userPermissions.get(userId);
  }

  getBorrowRecord(recordId: string): BorrowRecord | undefined {
    return this.borrowRecords.get(recordId);
  }

  getAllCases(): Case[] {
    return [...this.cases.values()];
  }

  getAllBorrowRecords(): BorrowRecord[] {
    return [...this.borrowRecords.values()];
  }

  getAllUserPermissions(): UserPermission[] {
    return [...this.userPermissions.values()];
  }
}
