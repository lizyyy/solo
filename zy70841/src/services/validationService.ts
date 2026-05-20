import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import {
  BoothApplication,
  BoothStatus,
  DocumentType,
  FailureReason,
  IssueDetail,
  ValidationResult
} from '../types';
import { store } from '../store/memoryStore';

export class ValidationService {
  validateApplication(application: BoothApplication): ValidationResult {
    const issues: IssueDetail[] = [];
    const suggestions: string[] = [];

    this.validateDocuments(application, issues, suggestions);
    this.validateTimeConflict(application, issues, suggestions);
    this.validateDeposit(application, issues, suggestions);
    this.validateRequiredFields(application, issues, suggestions);

    const status = this.determineStatus(issues);

    return {
      applicationId: application.id,
      boothNumber: application.boothNumber,
      companyName: application.companyName,
      status,
      originalData: this.getOriginalData(application),
      issues,
      suggestions,
      processedAt: moment().toISOString(),
      traceId: uuidv4()
    };
  }

  private validateDocuments(
    application: BoothApplication,
    issues: IssueDetail[],
    suggestions: string[]
  ): void {
    const requiredTypes = [DocumentType.BUSINESS_LICENSE, DocumentType.FIRE_SAFETY];
    
    for (const requiredType of requiredTypes) {
      const doc = application.documents.find(d => d.type === requiredType);
      
      if (!doc) {
        const docName = this.getDocumentTypeName(requiredType);
        issues.push({
          field: `documents.${requiredType}`,
          reason: FailureReason.MISSING_DOCUMENT,
          message: `缺少${docName}`,
          currentValue: null,
          expectedValue: `需要提供${docName}`
        });
        suggestions.push(`请补充${docName}材料`);
        continue;
      }

      if (doc.expiryDate && this.isDocumentExpired(doc.expiryDate)) {
        const docName = this.getDocumentTypeName(requiredType);
        issues.push({
          field: `documents.${requiredType}.expiryDate`,
          reason: FailureReason.DOCUMENT_EXPIRED,
          message: `${docName}已过期或即将过期`,
          currentValue: doc.expiryDate,
          expectedValue: `有效期需覆盖活动期间（${application.startTime} 至 ${application.endTime}）`
        });
        suggestions.push(`${docName}有效期至 ${doc.expiryDate}，请在活动开始前更新证照`);
      }
    }
  }

  private isDocumentExpired(expiryDate: string): boolean {
    const expiry = moment(expiryDate);
    const today = moment();
    return expiry.isBefore(today.add(7, 'days'));
  }

  private validateTimeConflict(
    application: BoothApplication,
    issues: IssueDetail[],
    suggestions: string[]
  ): void {
    if (!application.startTime || !application.endTime) {
      return;
    }

    const existingEvents = store.getCalendarEventsByBooth(application.boothNumber);
    
    const appStart = moment(application.startTime);
    const appEnd = moment(application.endTime);

    if (!appStart.isValid() || !appEnd.isValid()) {
      issues.push({
        field: 'time',
        reason: FailureReason.INVALID_DATA,
        message: '时间格式无效',
        currentValue: `${application.startTime} - ${application.endTime}`
      });
      return;
    }

    if (appEnd.isBefore(appStart)) {
      issues.push({
        field: 'time',
        reason: FailureReason.INVALID_DATA,
        message: '结束时间不能早于开始时间',
        currentValue: `${application.startTime} - ${application.endTime}`
      });
      return;
    }

    for (const event of existingEvents) {
      const eventStart = moment(event.startTime);
      const eventEnd = moment(event.endTime);

      if (this.hasOverlap(appStart, appEnd, eventStart, eventEnd)) {
        issues.push({
          field: 'time',
          reason: FailureReason.TIME_CONFLICT,
          message: `摊位 ${application.boothNumber} 时间冲突`,
          currentValue: `${application.startTime} - ${application.endTime}`,
          expectedValue: `与 ${event.companyName} 的 ${event.startTime} - ${event.endTime} 重叠`
        });
        suggestions.push(`建议调整时间至 ${this.findAlternativeSlot(appStart, appEnd, eventStart, eventEnd)}`);
      }
    }
  }

  private hasOverlap(
    start1: moment.Moment,
    end1: moment.Moment,
    start2: moment.Moment,
    end2: moment.Moment
  ): boolean {
    return start1.isBefore(end2) && start2.isBefore(end1);
  }

  private findAlternativeSlot(
    desiredStart: moment.Moment,
    desiredEnd: moment.Moment,
    conflictStart: moment.Moment,
    conflictEnd: moment.Moment
  ): string {
    const beforeConflict = `${desiredStart.format('YYYY-MM-DD')} 至 ${conflictStart.subtract(1, 'day').format('YYYY-MM-DD')}`;
    const afterConflict = `${conflictEnd.add(1, 'day').format('YYYY-MM-DD')} 之后`;
    return `可选时段: ${beforeConflict} 或 ${afterConflict}`;
  }

  private validateDeposit(
    application: BoothApplication,
    issues: IssueDetail[],
    suggestions: string[]
  ): void {
    const { depositAmount, depositPaid } = application;
    
    if (depositAmount <= 0) {
      return;
    }

    const depositRatio = depositPaid / depositAmount;
    
    if (depositPaid < depositAmount) {
      issues.push({
        field: 'deposit',
        reason: FailureReason.DEPOSIT_INSUFFICIENT,
        message: '押金不足',
        currentValue: `已缴 ${depositPaid}`,
        expectedValue: `应缴 ${depositAmount}`
      });
      
      const remaining = depositAmount - depositPaid;
      
      if (depositRatio >= 0.5) {
        suggestions.push(`押金已缴${(depositRatio * 100).toFixed(0)}%，请在进场前补缴剩余 ${remaining} 元`);
      } else {
        suggestions.push(`请尽快补缴押金 ${remaining} 元，否则可能影响摊位预订`);
      }
    }
  }

  private validateRequiredFields(
    application: BoothApplication,
    issues: IssueDetail[],
    suggestions: string[]
  ): void {
    const requiredFields = ['boothNumber', 'companyName', 'startTime', 'endTime'];
    
    for (const field of requiredFields) {
      const value = (application as any)[field];
      if (!value || String(value).trim() === '') {
        issues.push({
          field,
          reason: FailureReason.INVALID_DATA,
          message: `${this.getFieldDisplayName(field)}不能为空`,
          currentValue: value
        });
        suggestions.push(`请填写${this.getFieldDisplayName(field)}`);
      }
    }
  }

  private getFieldDisplayName(field: string): string {
    const fieldNames: Record<string, string> = {
      boothNumber: '摊位编号',
      companyName: '公司名称',
      startTime: '开始时间',
      endTime: '结束时间',
      contactPerson: '联系人',
      contactPhone: '联系电话'
    };
    return fieldNames[field] || field;
  }

  private getDocumentTypeName(type: DocumentType): string {
    const names: Record<DocumentType, string> = {
      [DocumentType.BUSINESS_LICENSE]: '营业执照',
      [DocumentType.FIRE_SAFETY]: '消防材料',
      [DocumentType.DEPOSIT_RECEIPT]: '押金收据'
    };
    return names[type] || type;
  }

  private determineStatus(issues: IssueDetail[]): BoothStatus {
    if (issues.length === 0) {
      return BoothStatus.NORMAL;
    }

    const fatalReasons = [
      FailureReason.DOCUMENT_EXPIRED,
      FailureReason.MISSING_DOCUMENT
    ];

    const hasFatalIssue = issues.some(issue => fatalReasons.includes(issue.reason));
    
    if (hasFatalIssue) {
      return BoothStatus.FAILED;
    }

    return BoothStatus.PENDING;
  }

  private getOriginalData(application: BoothApplication): Record<string, any> {
    return {
      boothNumber: application.boothNumber,
      companyName: application.companyName,
      contactPerson: application.contactPerson,
      contactPhone: application.contactPhone,
      startTime: application.startTime,
      endTime: application.endTime,
      depositAmount: application.depositAmount,
      depositPaid: application.depositPaid,
      documents: application.documents.map(d => ({
        type: d.type,
        documentNumber: d.documentNumber,
        expiryDate: d.expiryDate,
        fileName: d.fileName
      }))
    };
  }
}

export const validationService = new ValidationService();
