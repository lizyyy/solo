import { createHash } from 'crypto';
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
  private discrepancies: Map<string, Discrepancy> = new Map();
  private currentReconciliationId: string = '';

  loadData(cases: Case[], borrowRecords: BorrowRecord[], permissions: UserPermission[]): void {
    this.cases.clear();
    this.borrowRecords.clear();
    this.userPermissions.clear();
    this.discrepancies.clear();
    this.currentReconciliationId = '';

    cases.forEach(c => this.cases.set(c.caseId, c));
    borrowRecords.forEach(r => this.borrowRecords.set(r.recordId, r));
    permissions.forEach(p => this.userPermissions.set(p.userId, p));
  }

  runReconciliation(): ReconciliationResult {
    const existingResolved = new Map<string, boolean>();
    this.discrepancies.forEach((d, id) => {
      if (d.isResolved) {
        existingResolved.set(id, true);
      }
    });

    this.discrepancies.clear();

    for (const record of this.borrowRecords.values()) {
      this.checkRecord(record, existingResolved);
    }

    this.currentReconciliationId = uuidv4();
    const summary = this.calculateSummary();

    return {
      reconciliationId: this.currentReconciliationId,
      createdAt: new Date().toISOString(),
      totalRecords: this.borrowRecords.size,
      matchedRecords: this.borrowRecords.size - this.getUnresolvedDiscrepancies().length,
      discrepancyCount: this.getUnresolvedDiscrepancies().length,
      discrepancies: [...this.discrepancies.values()],
      reviewedRecords: this.getResolvedRecordIds(),
      summary
    };
  }

  private checkRecord(record: BorrowRecord, existingResolved: Map<string, boolean>): void {
    const caseInfo = this.cases.get(record.caseId);
    const userPermission = this.userPermissions.get(record.borrowerId);

    this.checkOverdue(record, existingResolved);
    this.checkClassification(record, caseInfo, userPermission, existingResolved);
    this.checkRenewalLimit(record, userPermission, existingResolved);
    this.checkPermission(record, userPermission, existingResolved);
  }

  private checkOverdue(record: BorrowRecord, existingResolved: Map<string, boolean>): void {
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
      }, existingResolved);
    }
  }

  private checkClassification(
    record: BorrowRecord,
    caseInfo?: Case,
    userPermission?: UserPermission,
    existingResolved?: Map<string, boolean>
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
      }, existingResolved);
    }
  }

  private checkRenewalLimit(record: BorrowRecord, userPermission?: UserPermission, existingResolved?: Map<string, boolean>): void {
    if (!userPermission) return;

    if (record.renewalCount > userPermission.maxRenewals) {
      this.addDiscrepancy({
        type: DiscrepancyType.RENEWAL_LIMIT_EXCEEDED,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: 'medium',
        description: `续借次数超限: ${record.renewalCount}次`,
        explanation: `用户【${userPermission.userName}】最大续借次数为${userPermission.maxRenewals}次，当前已续借${record.renewalCount}次，超出${record.renewalCount - userPermission.maxRenewals}次。需核实审批记录。`
      }, existingResolved);
    }
  }

  private checkPermission(record: BorrowRecord, userPermission?: UserPermission, existingResolved?: Map<string, boolean>): void {
    if (!userPermission) {
      this.addDiscrepancy({
        type: DiscrepancyType.PERMISSION_DENIED,
        recordId: record.recordId,
        caseId: record.caseId,
        severity: 'high',
        description: '用户权限记录不存在',
        explanation: `借阅人【${record.borrowerName}】ID: ${record.borrowerId} 在人员权限表中无记录。此借阅可能未经授权，需立即核实。`
      }, existingResolved);
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
      }, existingResolved);
    }
  }

  private generateStableDiscrepancyId(recordId: string, type: DiscrepancyType): string {
    const hash = createHash('md5');
    hash.update(`${recordId}-${type}`);
    return `disc-${hash.digest('hex').substring(0, 12)}`;
  }

  private addDiscrepancy(
    discrepancy: Omit<Discrepancy, 'discrepancyId' | 'isResolved'>,
    existingResolved?: Map<string, boolean>
  ): void {
    const discrepancyId = this.generateStableDiscrepancyId(discrepancy.recordId, discrepancy.type);
    const isResolved = existingResolved ? existingResolved.get(discrepancyId) || false : false;

    this.discrepancies.set(discrepancyId, {
      ...discrepancy,
      discrepancyId,
      isResolved
    });
  }

  resolveDiscrepancy(discrepancyId: string): boolean {
    const discrepancy = this.discrepancies.get(discrepancyId);
    if (discrepancy) {
      discrepancy.isResolved = true;
      return true;
    }
    return false;
  }

  getDiscrepancy(discrepancyId: string): Discrepancy | undefined {
    return this.discrepancies.get(discrepancyId);
  }

  getAllDiscrepancies(): Discrepancy[] {
    return [...this.discrepancies.values()];
  }

  getUnresolvedDiscrepancies(): Discrepancy[] {
    return [...this.discrepancies.values()].filter(d => !d.isResolved);
  }

  getResolvedRecordIds(): string[] {
    const resolvedRecords = new Set<string>();
    this.discrepancies.forEach(d => {
      if (d.isResolved) {
        resolvedRecords.add(d.recordId);
      }
    });
    return [...resolvedRecords];
  }

  private calculateSummary(): ReconciliationResult['summary'] {
    const unresolved = this.getUnresolvedDiscrepancies();
    return {
      overdue: unresolved.filter(d => d.type === DiscrepancyType.OVERDUE).length,
      classificationIssues: unresolved.filter(d => d.type === DiscrepancyType.CLASSIFICATION_MISMATCH).length,
      renewalIssues: unresolved.filter(d => d.type === DiscrepancyType.RENEWAL_LIMIT_EXCEEDED).length,
      permissionIssues: unresolved.filter(d => d.type === DiscrepancyType.PERMISSION_DENIED).length
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

  getCurrentReconciliationId(): string {
    return this.currentReconciliationId;
  }
}
