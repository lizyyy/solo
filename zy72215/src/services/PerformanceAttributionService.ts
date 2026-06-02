import { DataStore } from '../data/DataStore';
import { UnifiedDataService } from '../data/UnifiedDataService';
import { TradeRecordFactory, RawTradeRecord } from '../core/TradeRecordFactory';
import { StatusFlowHandler } from '../core/StatusFlowHandler';
import { ImportResult, PerformanceReport, RecordStatus } from '../types';

export class PerformanceAttributionService {
  private static dataStore = DataStore.getInstance();

  static importRecords(rawRecords: RawTradeRecord[], operator: string): ImportResult {
    const result = TradeRecordFactory.batchImport(rawRecords, operator);
    this.dataStore.addRecords(result.records);
    return result;
  }

  static submitForReview(recordId: string, operator: string, custodianPageRef?: string): boolean {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return false;

    const updated = StatusFlowHandler.moveToPendingReview(record, operator, custodianPageRef);
    return this.dataStore.updateRecord(recordId, updated);
  }

  static reviewAsNormal(recordId: string, operator: string, remark?: string): boolean {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return false;

    const updated = StatusFlowHandler.reviewAsNormal(record, operator, remark);
    return this.dataStore.updateRecord(recordId, updated);
  }

  static reviewWithAdjustment(
    recordId: string,
    operator: string,
    adjustedAmount: number,
    remark: string
  ): boolean {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return false;

    const updated = StatusFlowHandler.reviewWithAdjustment(record, operator, adjustedAmount, remark);
    return this.dataStore.updateRecord(recordId, updated);
  }

  static markAsSummarized(recordId: string, operator: string): boolean {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return false;

    const updated = StatusFlowHandler.markAsSummarized(record, operator);
    return this.dataStore.updateRecord(recordId, updated);
  }

  static rollbackRecord(recordId: string, operator: string, reason: string): boolean {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return false;

    const updated = StatusFlowHandler.rollback(record, operator, reason);
    return this.dataStore.updateRecord(recordId, updated);
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
