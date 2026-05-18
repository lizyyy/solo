import { createObjectCsvWriter } from 'csv-writer';
import { ReturnBucketRecord, ExportQueryParams, ReturnBucketStatus } from './types';
import { returnBucketService } from './service';
import * as path from 'path';

class ExportService {
  private getKeyBusinessColumns(): Array<{ id: keyof ReturnBucketRecord; title: string }> {
    return [
      { id: 'bucketNumber', title: '桶编号' },
      { id: 'bucketType', title: '桶类型' },
      { id: 'waterStationName', title: '水站名称' },
      { id: 'deliveryTeamName', title: '配送队名称' },
      { id: 'driverName', title: '配送员姓名' },
      { id: 'driverPhone', title: '配送员电话' },
      { id: 'customerName', title: '客户姓名' },
      { id: 'customerPhone', title: '客户电话' },
      { id: 'customerAddress', title: '客户地址' },
      { id: 'customerAddressDetail', title: '客户详细地址' },
      { id: 'returnDate', title: '退桶日期' },
      { id: 'returnQuantity', title: '退桶数量' },
      { id: 'returnReason', title: '退桶原因' },
      { id: 'bucketCondition', title: '桶况' },
      { id: 'hasDamage', title: '是否破损' },
      { id: 'damageDescription', title: '破损说明' },
      { id: 'status', title: '状态' },
      { id: 'rejectReason', title: '驳回原因' },
      { id: 'supplementMaterials', title: '需补材料' },
      { id: 'supplementRemark', title: '补录备注' },
      { id: 'ledgerConsistent', title: '台账一致' },
      { id: 'ledgerInconsistencyReason', title: '不一致原因' },
      { id: 'duplicateBucketAddress', title: '重复桶地址' },
      { id: 'receiverName', title: '接收人' },
      { id: 'receiveDate', title: '接收日期' },
      { id: 'createTime', title: '创建时间' },
      { id: 'operatorName', title: '操作人' },
      { id: 'remark', title: '备注' }
    ];
  }

  private formatRecordForExport(record: ReturnBucketRecord): Record<string, any> {
    const result: Record<string, any> = {};
    const columns = this.getKeyBusinessColumns();

    for (const col of columns) {
      const value = record[col.id];
      if (Array.isArray(value)) {
        result[col.id] = value.join('、');
      } else if (typeof value === 'boolean') {
        result[col.id] = value ? '是' : '否';
      } else {
        result[col.id] = value ?? '';
      }
    }

    return result;
  }

  async exportToCsv(params: ExportQueryParams, outputPath?: string): Promise<string> {
    const records = returnBucketService.getRecordsForExport(params);
    const columns = this.getKeyBusinessColumns();

    const filePath = outputPath || path.join(process.cwd(), `退桶导出_${new Date().toISOString().slice(0, 10)}.csv`);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: columns.map(col => ({
        id: col.id as string,
        title: col.title
      })),
      encoding: 'utf-8'
    });

    const formattedRecords = records.map(r => this.formatRecordForExport(r));
    await csvWriter.writeRecords(formattedRecords);

    return filePath;
  }

  getExportData(params: ExportQueryParams): {
    columns: Array<{ id: string; title: string }>;
    data: ReturnBucketRecord[];
    summary: {
      total: number;
      byStatus: Record<ReturnBucketStatus, number>;
    };
  } {
    const records = returnBucketService.getRecordsForExport(params);
    const columns = this.getKeyBusinessColumns();

    const byStatus: Record<ReturnBucketStatus, number> = {
      [ReturnBucketStatus.NORMAL]: 0,
      [ReturnBucketStatus.REJECTED]: 0,
      [ReturnBucketStatus.SUPPLEMENT]: 0,
      [ReturnBucketStatus.COMPLETED]: 0
    };

    for (const record of records) {
      if (record.status in byStatus) {
        byStatus[record.status]++;
      }
    }

    return {
      columns,
      data: records,
      summary: {
        total: records.length,
        byStatus
      }
    };
  }
}

export const exportService = new ExportService();
