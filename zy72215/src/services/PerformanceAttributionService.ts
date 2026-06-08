import { DataStore } from '../data/DataStore';
import { UnifiedDataService } from '../data/UnifiedDataService';
import { TradeRecordFactory, RawTradeRecord } from '../core/TradeRecordFactory';
import { StatusFlowHandler } from '../core/StatusFlowHandler';
import { ImportResult, PerformanceReport, RecordStatus, TransitionResult } from '../types';

export class PerformanceAttributionService {
  private static dataStore = DataStore.getInstance();

  static importRecords(rawRecords: RawTradeRecord[], operator: string): ImportResult {
    const result = TradeRecordFactory.batchImport(rawRecords, operator);
    this.dataStore.addRecords(result.records);
    return result;
  }

  static submitForReview(recordId: string, operator: string, custodianPageRef?: string): TransitionResult {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return { success: false, error: '记录不存在' };

    const result = StatusFlowHandler.moveToPendingReview(record, operator, custodianPageRef);
    if (!result.success || !result.record) return result;

    this.dataStore.updateRecord(recordId, result.record);
    return { success: true };
  }

  static reviewAsNormal(recordId: string, operator: string, remark?: string): TransitionResult {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return { success: false, error: '记录不存在' };

    const result = StatusFlowHandler.reviewAsNormal(record, operator, remark);
    if (!result.success || !result.record) return result;

    this.dataStore.updateRecord(recordId, result.record);
    return { success: true };
  }

  static reviewWithAdjustment(
    recordId: string,
    operator: string,
    adjustedAmount: number,
    remark: string
  ): TransitionResult {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return { success: false, error: '记录不存在' };

    const result = StatusFlowHandler.reviewWithAdjustment(record, operator, adjustedAmount, remark);
    if (!result.success || !result.record) return result;

    this.dataStore.updateRecord(recordId, result.record);
    return { success: true };
  }

  static markAsSummarized(recordId: string, operator: string): TransitionResult {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return { success: false, error: '记录不存在' };

    const result = StatusFlowHandler.markAsSummarized(record, operator);
    if (!result.success || !result.record) return result;

    this.dataStore.updateRecord(recordId, result.record);
    return { success: true };
  }

  static rollbackRecord(recordId: string, operator: string, reason: string): TransitionResult {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return { success: false, error: '记录不存在' };

    const result = StatusFlowHandler.rollback(record, operator, reason);
    if (!result.success || !result.record) return result;

    this.dataStore.updateRecord(recordId, result.record);
    return { success: true };
  }

  static getReport(reportDate: string): PerformanceReport {
    return UnifiedDataService.getApiData(reportDate);
  }

  static getPageData(reportDate: string) {
    return UnifiedDataService.getPageData(reportDate);
  }

  static getExportData(reportDate: string) {
    return UnifiedDataService.getExportData(reportDate);
  }

  static getAuditTrail(recordId: string) {
    return UnifiedDataService.getAuditTrail(recordId);
  }

  static getRecordDetail(recordId: string) {
    return UnifiedDataService.getRecordDetail(recordId);
  }

  static getManagerSummary(reportDate: string) {
    return this.dataStore.getSummaryForManager(reportDate);
  }

  static getZeroWithReversalRecords(reportDate?: string) {
    if (reportDate) {
      return this.dataStore.getRecordsByDate(reportDate).filter(r => r.isZeroWithReversal);
    }
    return this.dataStore.getZeroWithReversalRecords();
  }

  static getPendingReviewRecords(reportDate?: string) {
    const records = reportDate
      ? this.dataStore.getRecordsByDate(reportDate)
      : this.dataStore.getAllRecords();

    return records.filter(r => r.status === RecordStatus.PENDING_REVIEW);
  }
}
