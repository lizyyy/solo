import { Parser } from 'json2csv';
import dataStore from '../models/DataStore';
import { ProcessingRecord, QueryParams, OperationType, BoundaryType } from '../types';

class ExportService {
  exportToCSV(records: ProcessingRecord[]): string {
    const fields = [
      { value: 'receiptNo', label: '小票编号' },
      { value: 'memberId', label: '会员ID' },
      { value: 'memberLevel', label: '会员等级' },
      { value: 'transactionTime', label: '交易时间' },
      { value: 'totalAmount', label: '交易金额(元)' },
      { value: 'activityCode', label: '活动编码' },
      { value: 'activityName', label: '活动名称' },
      { value: 'calculatedPoints', label: '计算积分' },
      { value: 'status', label: '状态' },
      { value: 'isReturn', label: '是否退货' },
      { value: 'originalReceiptNo', label: '原小票编号' },
      { value: 'hasBoundary', label: '边界标记' },
      { value: 'boundaryType', label: '边界类型' },
      { value: 'boundaryDescription', label: '边界说明' },
      { value: 'lastOperator', label: '最后处理人' },
      { value: 'lastOperateTime', label: '最后处理时间' },
      { value: 'lastReason', label: '处理原因' }
    ];

    const data = records.map(record => {
      const lastTrail = record.auditTrail[record.auditTrail.length - 1];
      return {
        receiptNo: record.receiptNo,
        memberId: record.memberId,
        memberLevel: record.memberLevel,
        transactionTime: record.transactionTime.toLocaleString(),
        totalAmount: record.totalAmount,
        activityCode: record.activityCode,
        activityName: record.activityName,
        calculatedPoints: record.calculatedPoints,
        status: this.getStatusName(record.status),
        isReturn: record.isReturn ? '是' : '否',
        originalReceiptNo: record.originalReceiptNo || '',
        hasBoundary: record.boundaryInfo ? '是' : '否',
        boundaryType: record.boundaryInfo ? this.getBoundaryTypeName(record.boundaryInfo.type) : '',
        boundaryDescription: record.boundaryInfo?.description || '',
        lastOperator: lastTrail?.operator || '',
        lastOperateTime: lastTrail?.timestamp.toLocaleString() || '',
        lastReason: lastTrail?.reason || ''
      };
    });

    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  exportRecordsWithQuery(params: QueryParams, operator: string): { csv: string; count: number } {
    const result = dataStore.queryProcessingRecords({
      ...params,
      page: 1,
      pageSize: 10000
    });

    const csv = this.exportToCSV(result.data);

    dataStore.addOperationLog({
      operationType: OperationType.BATCH_EXPORTED,
      operator,
      reason: '导出处理记录',
      detail: `导出${result.total}条记录，查询条件：${JSON.stringify(params)}`
    });

    return { csv, count: result.total };
  }

  exportBatchRecords(batchId: string, operator: string): { csv: string; count: number } {
    const records = dataStore.getProcessingRecordsByBatch(batchId);
    const csv = this.exportToCSV(records);

    dataStore.addOperationLog({
      batchId,
      operationType: OperationType.BATCH_EXPORTED,
      operator,
      reason: '导出批次记录',
      detail: `导出批次${batchId}的${records.length}条记录`
    });

    return { csv, count: records.length };
  }

  verifyExportConsistency(params: QueryParams): boolean {
    const queryResult = dataStore.queryProcessingRecords(params);
    const exportResult = this.exportRecordsWithQuery(params, 'system');
    return queryResult.total === exportResult.count;
  }

  private getStatusName(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待处理',
      APPROVED: '已放行',
      REJECTED: '已拒绝',
      RETURNED: '退回修改',
      REVERSED: '已冲正'
    };
    return statusMap[status] || status;
  }

  private getBoundaryTypeName(type: BoundaryType): string {
    const typeMap: Record<BoundaryType, string> = {
      [BoundaryType.RETURN_REVERSAL]: '退货冲正',
      [BoundaryType.MULTIPLIER_BOUNDARY]: '倍率边界',
      [BoundaryType.DUPLICATE_REIMPORT]: '重复补录',
      [BoundaryType.AMOUNT_BOUNDARY]: '金额边界',
      [BoundaryType.TIME_BOUNDARY]: '时间边界',
      [BoundaryType.LEVEL_BOUNDARY]: '等级边界'
    };
    return typeMap[type] || type;
  }
}

export default new ExportService();
