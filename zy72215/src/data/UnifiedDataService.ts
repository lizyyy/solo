import { TradeRecord, PerformanceReport, RecordStatus } from '../types';
import { DataStore } from './DataStore';

export class UnifiedDataService {
  private static dataStore = DataStore.getInstance();

  static getPageData(reportDate: string): {
    report: PerformanceReport;
    needsAttention: TradeRecord[];
  } {
    const report = this.dataStore.getPerformanceReport(reportDate);
    const needsAttention = report.records.filter(r => 
      r.status === RecordStatus.ZERO_WITH_REVERSAL || 
      r.status === RecordStatus.PENDING_REVIEW
    );

    return { report, needsAttention };
  }

  static getApiData(reportDate: string): PerformanceReport {
    return this.dataStore.getPerformanceReport(reportDate);
  }

  static getExportData(reportDate: string): Array<{
    交易日期: string;
    交易员ID: string;
    证券代码: string;
    证券名称: string;
    数量: number;
    原始金额: number;
    当前金额: number;
    备注: string;
    状态: string;
    风险标记: string;
    原始行号?: number;
    人工调整?: number;
    托管页参考?: string;
  }> {
    const report = this.dataStore.getPerformanceReport(reportDate);
    
    return report.records.map(r => ({
      '交易日期': r.tradeDate,
      '交易员ID': r.traderId,
      '证券代码': r.instrumentId,
      '证券名称': r.instrumentName,
      '数量': r.quantity,
      '原始金额': r.originalAmount,
      '当前金额': r.amount,
      '备注': r.remark,
      '状态': this.getStatusText(r.status),
      '风险标记': r.isZeroWithReversal ? '金额为0-待冲正复核' : '正常',
      '原始行号': r.tailDiffAdjustment?.originalLineNumber,
      '人工调整': r.tailDiffAdjustment?.manualChange,
      '托管页参考': r.tailDiffAdjustment?.custodianPageReference
    }));
  }

  static getAuditTrail(recordId: string): Array<{
    时间: string;
    操作人: string;
    动作: string;
    备注?: string;
  }> {
    const record = this.dataStore.getRecord(recordId);
    if (!record) return [];

    return record.auditLogs.map(log => ({
      '时间': log.timestamp.toISOString(),
      '操作人': log.operator,
      '动作': log.action,
      '备注': log.remark
    }));
  }

  static getRecordDetail(recordId: string): TradeRecord | undefined {
    return this.dataStore.getRecord(recordId);
  }

  private static getStatusText(status: RecordStatus): string {
    const statusMap: Record<RecordStatus, string> = {
      [RecordStatus.PENDING_IMPORT]: '待导入',
      [RecordStatus.IMPORTED]: '已导入',
      [RecordStatus.ZERO_WITH_REVERSAL]: '金额为0-待冲正复核',
      [RecordStatus.PENDING_REVIEW]: '待风控复核',
      [RecordStatus.REVIEWED_NORMAL]: '复核通过-正常',
      [RecordStatus.REVIEWED_ADJUSTED]: '复核通过-已调整',
      [RecordStatus.SUMMARIZED]: '已纳入摘要'
    };
    return statusMap[status] || status;
  }
}
