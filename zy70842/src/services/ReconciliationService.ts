import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import {
  BoothApplication,
  LicenseAttachment,
  VenueCalendar,
  ReconciliationRecord,
  Discrepancy,
  DiscrepancyType,
  DiscrepancyStatus,
  ReviewResult,
  ReviewAction,
  ReconciliationSummary,
  DeductionItem
} from '../models/types';
import { dataStore } from '../models/store';

class ReconciliationService {
  async createReconciliation(applicationId: string): Promise<ReconciliationRecord | null> {
    const application = dataStore.getBoothApplication(applicationId);
    if (!application) {
      return null;
    }

    const existingRecord = dataStore.getReconciliationByApplicationId(applicationId);
    if (existingRecord) {
      return existingRecord;
    }

    const record: ReconciliationRecord = {
      id: uuidv4(),
      applicationId: application.id,
      applicationNo: application.applicationNo,
      merchantName: application.merchantName,
      boothLocation: application.boothLocation,
      startDate: application.startDate,
      endDate: application.endDate,
      boothFee: application.boothFee,
      depositAmount: application.depositAmount,
      actualBoothFee: application.boothFee,
      actualDepositAmount: application.depositAmount,
      deductions: [],
      totalAmount: application.boothFee + application.depositAmount,
      discrepancies: [],
      reviewActions: [],
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.addReconciliationRecord(record);

    await this.autoCheck(record.id);

    return dataStore.getReconciliationRecord(record.id) || null;
  }

  async autoCheck(reconciliationId: string): Promise<Discrepancy[]> {
    const record = dataStore.getReconciliationRecord(reconciliationId);
    if (!record) {
      return [];
    }

    const discrepancies: Discrepancy[] = [];

    discrepancies.push(...this.checkLicenseExpiry(record));
    discrepancies.push(...this.checkTimeConflict(record));
    discrepancies.push(...this.checkMissingDocuments(record));
    discrepancies.push(...this.checkFeeMismatch(record));

    for (const disc of discrepancies) {
      record.discrepancies.push(disc);
    }

    const requiresManualReview = discrepancies.some(d => d.requiresManualReview);
    record.status = requiresManualReview ? 'REVIEWING' : 'APPROVED';

    this.recalculateAmount(record);

    dataStore.updateReconciliationRecord(reconciliationId, {
      discrepancies: record.discrepancies,
      status: record.status,
      actualBoothFee: record.actualBoothFee,
      actualDepositAmount: record.actualDepositAmount,
      deductions: record.deductions,
      totalAmount: record.totalAmount
    });

    return discrepancies;
  }

  private checkLicenseExpiry(record: ReconciliationRecord): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const licenses = dataStore.getLicenseAttachmentsByApplicationId(record.applicationId);
    const today = dayjs();

    for (const license of licenses) {
      if (license.expiryDate) {
        const expiryDate = dayjs(license.expiryDate);
        
        if (expiryDate.isBefore(today)) {
          discrepancies.push({
            id: uuidv4(),
            reconciliationId: record.id,
            type: DiscrepancyType.LICENSE_EXPIRED,
            description: `${this.getLicenseTypeName(license.licenseType)}已过期`,
            sourceField: 'license.expiryDate',
            expectedValue: `有效日期 > ${today.format('YYYY-MM-DD')}`,
            actualValue: license.expiryDate,
            severity: 'HIGH',
            status: DiscrepancyStatus.PENDING,
            requiresManualReview: true,
            explanation: `证照将于活动开始前已过期，需要商户更新证照后才能继续审批通过。`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } else if (expiryDate.diff(today, 'day') <= 30) {
          discrepancies.push({
            id: uuidv4(),
            reconciliationId: record.id,
            type: DiscrepancyType.LICENSE_EXPIRED,
            description: `${this.getLicenseTypeName(license.licenseType)}即将过期（剩余${expiryDate.diff(today, 'day')}天）`,
            sourceField: 'license.expiryDate',
            expectedValue: `有效日期 > ${today.format('YYYY-MM-DD')}`,
            actualValue: license.expiryDate,
            severity: 'MEDIUM',
            status: DiscrepancyStatus.PENDING,
            requiresManualReview: false,
            explanation: `证照将在30天内过期，建议提醒商户及时更新。`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    return discrepancies;
  }

  private checkTimeConflict(record: ReconciliationRecord): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const calendars = dataStore.getVenueCalendarByDateRange(
      record.boothLocation,
      record.startDate,
      record.endDate
    );

    const conflictDates: string[] = [];
    const bookedBy: string[] = [];

    for (const cal of calendars) {
      if (!cal.isAvailable && cal.bookedApplicationId && cal.bookedApplicationId !== record.applicationId) {
        conflictDates.push(cal.date);
        if (cal.bookedMerchantName && !bookedBy.includes(cal.bookedMerchantName)) {
          bookedBy.push(cal.bookedMerchantName);
        }
      }
    }

    if (conflictDates.length > 0) {
      discrepancies.push({
        id: uuidv4(),
        reconciliationId: record.id,
        type: DiscrepancyType.TIME_CONFLICT,
        description: `摊位时间冲突`,
        sourceField: 'booth.timerange',
        expectedValue: `${record.startDate} 至 ${record.endDate} 期间摊位空闲`,
        actualValue: `${conflictDates.join(', ')} 已被其他商户预订`,
        severity: 'HIGH',
        status: DiscrepancyStatus.PENDING,
        requiresManualReview: true,
        explanation: `申请的时间段内有 ${conflictDates.length} 天存在时间冲突，已被 ${bookedBy.join('、')} 预订。需要调整档期或与商户协商解决方案。`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const deduction: DeductionItem = {
        id: uuidv4(),
        type: '时间冲突扣减',
        amount: 0,
        reason: '时间冲突导致的费用调整',
        createdAt: new Date().toISOString()
      };
      record.deductions.push(deduction);
    }

    return discrepancies;
  }

  private checkMissingDocuments(record: ReconciliationRecord): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const licenses = dataStore.getLicenseAttachmentsByApplicationId(record.applicationId);
    const application = dataStore.getBoothApplication(record.applicationId);

    if (!application) return [];

    const requiredLicenses: string[] = [];
    if (application.boothType === '餐饮类') {
      requiredLicenses.push('BUSINESS_LICENSE', 'FOOD_SAFETY', 'FIRE_SAFETY');
    } else {
      requiredLicenses.push('BUSINESS_LICENSE');
    }

    const existingLicenseTypes = licenses.map(l => l.licenseType);
    const missingTypes = requiredLicenses.filter(t => !existingLicenseTypes.includes(t as any));

    if (missingTypes.length > 0) {
      discrepancies.push({
        id: uuidv4(),
        reconciliationId: record.id,
        type: DiscrepancyType.MISSING_DOCUMENT,
        description: '缺少必需证照',
        sourceField: 'license.documents',
        expectedValue: `需要提供: ${missingTypes.map(t => this.getLicenseTypeName(t as any)).join('、')}`,
        actualValue: '未提供',
        severity: 'HIGH',
        status: DiscrepancyStatus.PENDING,
        requiresManualReview: true,
        explanation: `根据摊位类型"${application.boothType}"，商户需要提供完整的证照材料。请通知商户补充提交。`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return discrepancies;
  }

  private checkFeeMismatch(record: ReconciliationRecord): Discrepancy[] {
    const discrepancies: Discrepancy[] = [];
    const calendars = dataStore.getVenueCalendarByDateRange(
      record.boothLocation,
      record.startDate,
      record.endDate
    );

    const availableDays = calendars.filter(c => c.isAvailable || c.bookedApplicationId === record.applicationId).length;
    const totalDays = dayjs(record.endDate).diff(dayjs(record.startDate), 'day') + 1;

    if (availableDays < totalDays && availableDays > 0) {
      const expectedFee = (record.boothFee / totalDays) * availableDays;
      const diffAmount = record.boothFee - expectedFee;

      if (Math.abs(diffAmount) > 0.01) {
        discrepancies.push({
          id: uuidv4(),
          reconciliationId: record.id,
          type: DiscrepancyType.FEE_MISMATCH,
          description: '实际使用天数与费用不匹配',
          sourceField: 'booth.fee',
          expectedValue: `预计费用 ${expectedFee.toFixed(2)} 元（${availableDays}天）`,
          actualValue: `申请费用 ${record.boothFee} 元（${totalDays}天）`,
          severity: 'MEDIUM',
          status: DiscrepancyStatus.PENDING,
          requiresManualReview: true,
          explanation: `由于时间冲突，实际可使用天数为 ${availableDays} 天，建议按照实际使用天数调整费用。`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    return discrepancies;
  }

  private getLicenseTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      BUSINESS_LICENSE: '营业执照',
      FIRE_SAFETY: '消防合格证',
      FOOD_SAFETY: '食品经营许可证',
      OTHER: '其他证照'
    };
    return typeMap[type] || type;
  }

  async reviewDiscrepancy(
    reconciliationId: string,
    discrepancyId: string,
    reviewer: string,
    result: ReviewResult,
    notes: string,
    adjustmentAmount?: number,
    adjustmentReason?: string
  ): Promise<ReconciliationRecord | null> {
    const record = dataStore.getReconciliationRecord(reconciliationId);
    if (!record) {
      return null;
    }

    const discrepancy = record.discrepancies.find(d => d.id === discrepancyId);
    if (!discrepancy) {
      return null;
    }

    const statusMap: Record<ReviewResult, DiscrepancyStatus> = {
      [ReviewResult.APPROVE]: DiscrepancyStatus.APPROVED,
      [ReviewResult.REJECT]: DiscrepancyStatus.REJECTED,
      [ReviewResult.REQUEST_DOCUMENTS]: DiscrepancyStatus.DOCUMENTS_REQUESTED,
      [ReviewResult.ADJUST_AND_APPROVE]: DiscrepancyStatus.APPROVED
    };

    discrepancy.status = statusMap[result];
    discrepancy.updatedAt = new Date().toISOString();

    const reviewAction: ReviewAction = {
      id: uuidv4(),
      reconciliationId,
      discrepancyId,
      reviewer,
      reviewResult: result,
      reviewNotes: notes,
      adjustmentAmount,
      adjustmentReason,
      reviewedAt: new Date().toISOString()
    };

    record.reviewActions.push(reviewAction);

    if (result === ReviewResult.ADJUST_AND_APPROVE && adjustmentAmount !== undefined) {
      const deduction: DeductionItem = {
        id: uuidv4(),
        type: adjustmentReason || '人工调整',
        amount: adjustmentAmount,
        reason: notes,
        createdAt: new Date().toISOString()
      };
      record.deductions.push(deduction);
    }

    this.recalculateAmount(record);

    const allResolved = record.discrepancies.every(
      d => d.status !== DiscrepancyStatus.PENDING
    );

    if (allResolved) {
      const hasRejected = record.discrepancies.some(
        d => d.status === DiscrepancyStatus.REJECTED
      );
      record.status = hasRejected ? 'REJECTED' : 'APPROVED';
      record.reviewedBy = reviewer;
      record.reviewedAt = new Date().toISOString();
    }

    dataStore.updateReconciliationRecord(reconciliationId, {
      discrepancies: record.discrepancies,
      reviewActions: record.reviewActions,
      deductions: record.deductions,
      actualBoothFee: record.actualBoothFee,
      actualDepositAmount: record.actualDepositAmount,
      totalAmount: record.totalAmount,
      status: record.status,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt
    });

    return dataStore.getReconciliationRecord(reconciliationId) || null;
  }

  private recalculateAmount(record: ReconciliationRecord): void {
    const totalDeductions = record.deductions.reduce((sum, d) => sum + d.amount, 0);
    record.actualBoothFee = Math.max(0, record.boothFee - totalDeductions);
    record.actualDepositAmount = record.depositAmount;
    record.totalAmount = record.actualBoothFee + record.actualDepositAmount;
  }

  async completeReconciliation(reconciliationId: string, reviewer: string): Promise<ReconciliationRecord | null> {
    const record = dataStore.getReconciliationRecord(reconciliationId);
    if (!record) {
      return null;
    }

    if (record.status !== 'APPROVED') {
      throw new Error('只有已批准的对账记录才能完成');
    }

    record.status = 'COMPLETED';
    record.completedAt = new Date().toISOString();
    record.reviewedBy = reviewer;
    record.reviewedAt = new Date().toISOString();

    dataStore.updateReconciliationRecord(reconciliationId, {
      status: record.status,
      completedAt: record.completedAt,
      reviewedBy: record.reviewedBy,
      reviewedAt: record.reviewedAt
    });

    return dataStore.getReconciliationRecord(reconciliationId) || null;
  }

  getSummary(): ReconciliationSummary {
    const records = dataStore.getAllReconciliationRecords();
    
    const discrepancyCount = {
      licenseExpired: 0,
      timeConflict: 0,
      depositDeduction: 0,
      missingDocument: 0,
      feeMismatch: 0,
      manualReview: 0
    };

    let totalBoothFee = 0;
    let totalDeposit = 0;
    let totalDeductions = 0;

    for (const record of records) {
      totalBoothFee += record.actualBoothFee;
      totalDeposit += record.actualDepositAmount;
      totalDeductions += record.deductions.reduce((sum, d) => sum + d.amount, 0);

      for (const disc of record.discrepancies) {
        switch (disc.type) {
          case DiscrepancyType.LICENSE_EXPIRED:
            discrepancyCount.licenseExpired++;
            break;
          case DiscrepancyType.TIME_CONFLICT:
            discrepancyCount.timeConflict++;
            break;
          case DiscrepancyType.DEPOSIT_DEDUCTION:
            discrepancyCount.depositDeduction++;
            break;
          case DiscrepancyType.MISSING_DOCUMENT:
            discrepancyCount.missingDocument++;
            break;
          case DiscrepancyType.FEE_MISMATCH:
            discrepancyCount.feeMismatch++;
            break;
          case DiscrepancyType.MANUAL_REVIEW:
            discrepancyCount.manualReview++;
            break;
        }
      }
    }

    return {
      totalRecords: records.length,
      approvedRecords: records.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
      rejectedRecords: records.filter(r => r.status === 'REJECTED').length,
      pendingRecords: records.filter(r => r.status === 'DRAFT' || r.status === 'REVIEWING').length,
      totalBoothFee,
      totalDeposit,
      totalDeductions,
      netAmount: totalBoothFee + totalDeposit,
      discrepancyCount
    };
  }

  async batchCreateAll(): Promise<ReconciliationRecord[]> {
    const applications = dataStore.getAllBoothApplications();
    const results: ReconciliationRecord[] = [];

    for (const app of applications) {
      const record = await this.createReconciliation(app.id);
      if (record) {
        results.push(record);
      }
    }

    return results;
  }
}

export const reconciliationService = new ReconciliationService();
