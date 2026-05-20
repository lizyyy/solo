import { Parser } from 'json2csv';
import moment from 'moment';
import { DataStore } from '../models/DataStore';
import { ProcessingService } from './ProcessingService';
import { ProcessingRecord, RecordStatus, ExportOptions, BoundaryLog } from '../types';

export class ExportService {
  private dataStore: DataStore;
  private processingService: ProcessingService;

  constructor() {
    this.dataStore = DataStore.getInstance();
    this.processingService = new ProcessingService();
  }

  public formatRecordForExport(record: ProcessingRecord, includeBoundaryDetails: boolean): Record<string, any> {
    const statusLabels: Record<RecordStatus, string> = {
      [RecordStatus.PENDING]: '待处理',
      [RecordStatus.APPROVED]: '已通过',
      [RecordStatus.REJECTED]: '已拒绝',
      [RecordStatus.RETURNED]: '退回修改'
    };

    const baseData = {
      '记录ID': record.id,
      '批次ID': record.batchId,
      '影片名称': record.filmName,
      '影厅': record.hallName || '',
      '日期': record.date,
      '状态': statusLabels[record.status],
      '当前处理人': record.currentHandler,
      '创建时间': moment(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      '更新时间': moment(record.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      '备注': record.remarks || '',
      '边界情况数量': record.boundaryLogs.length
    };

    if (includeBoundaryDetails && record.boundaryLogs.length > 0) {
      const boundaryExplanations = record.boundaryLogs
        .map(log => this.processingService.getBoundaryExplanation(log))
        .join('; ');
      
      return {
        ...baseData,
        '边界情况说明': boundaryExplanations
      };
    }

    return baseData;
  }

  public exportToCSV(records: ProcessingRecord[], options: ExportOptions): string {
    const formattedRecords = records.map(r => 
      this.formatRecordForExport(r, options.includeBoundaryDetails)
    );
    
    const fields = Object.keys(formattedRecords[0] || {});
    const json2csvParser = new Parser({ fields });
    
    return json2csvParser.parse(formattedRecords);
  }

  public exportToJSON(records: ProcessingRecord[], options: ExportOptions): string {
    const formattedRecords = records.map(r => ({
      ...this.formatRecordForExport(r, options.includeBoundaryDetails),
      boundaryLogs: options.includeBoundaryDetails ? r.boundaryLogs.map(log => ({
        type: log.type,
        reason: log.reason,
        handler: log.handler,
        timestamp: log.timestamp,
        explanation: this.processingService.getBoundaryExplanation(log)
      })) : undefined
    }));

    return JSON.stringify(formattedRecords, null, 2);
  }

  public exportRecords(
    queryParams: {
      filmName?: string;
      hallName?: string;
      settlementPeriod?: string;
      startDate?: string;
      endDate?: string;
      status?: RecordStatus;
      contractId?: string;
    },
    options: ExportOptions
  ): {
    content: string;
    count: number;
    querySummary: string;
  } {
    const records = this.dataStore.queryRecords(queryParams);
    
    if (records.length === 0) {
      return {
        content: '',
        count: 0,
        querySummary: this.buildQuerySummary(queryParams, 0)
      };
    }

    const content = options.format === 'csv' 
      ? this.exportToCSV(records, options)
      : this.exportToJSON(records, options);

    return {
      content,
      count: records.length,
      querySummary: this.buildQuerySummary(queryParams, records.length)
    };
  }

  private buildQuerySummary(params: any, count: number): string {
    const conditions: string[] = [];
    
    if (params.filmName) conditions.push(`影片：${params.filmName}`);
    if (params.hallName) conditions.push(`影厅：${params.hallName}`);
    if (params.settlementPeriod) conditions.push(`结算周期：${params.settlementPeriod}`);
    if (params.startDate && params.endDate) {
      conditions.push(`日期范围：${params.startDate} 至 ${params.endDate}`);
    }
    if (params.status) {
      const statusLabels: Record<RecordStatus, string> = {
        [RecordStatus.PENDING]: '待处理',
        [RecordStatus.APPROVED]: '已通过',
        [RecordStatus.REJECTED]: '已拒绝',
        [RecordStatus.RETURNED]: '退回修改'
      };
      conditions.push(`状态：${statusLabels[params.status]}`);
    }

    const conditionStr = conditions.length > 0 ? conditions.join('，') : '全部数据';
    return `查询条件：${conditionStr}，共导出 ${count} 条记录`;
  }

  public getBoundarySummary(records: ProcessingRecord[]): {
    totalRecords: number;
    crossDayCount: number;
    subsidyLimitCount: number;
    refundDeductionCount: number;
    boundaryRecords: ProcessingRecord[];
  } {
    const boundaryRecords = records.filter(r => r.boundaryLogs.length > 0);
    
    let crossDayCount = 0;
    let subsidyLimitCount = 0;
    let refundDeductionCount = 0;

    for (const record of boundaryRecords) {
      const types = new Set(record.boundaryLogs.map(log => log.type));
      if (types.has('cross_day')) crossDayCount++;
      if (types.has('subsidy_limit')) subsidyLimitCount++;
      if (types.has('refund_deduction')) refundDeductionCount++;
    }

    return {
      totalRecords: records.length,
      crossDayCount,
      subsidyLimitCount,
      refundDeductionCount,
      boundaryRecords
    };
  }
}
