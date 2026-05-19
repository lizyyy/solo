import { Parser } from 'json2csv';
import fs from 'fs';
import { WorkRecord, QueryFilter, ReportData, RecordStatus } from '../types';
import { dataStore } from '../store';

export class QueryService {
  queryRecords(filter: QueryFilter): WorkRecord[] {
    let records = dataStore.getAllRecords();

    if (filter.operator) {
      records = records.filter(r => r.operator === filter.operator);
    }

    if (filter.startDate) {
      records = records.filter(r => r.startTime >= filter.startDate!);
    }

    if (filter.endDate) {
      records = records.filter(r => r.endTime <= filter.endDate!);
    }

    if (filter.status && filter.status.length > 0) {
      records = records.filter(r => filter.status!.includes(r.status));
    }

    if (filter.exceptionType && filter.exceptionType.length > 0) {
      records = records.filter(r =>
        r.exceptions.some(e => filter.exceptionType!.includes(e.type))
      );
    }

    if (filter.tractorNo) {
      records = records.filter(r => r.tractorNo === filter.tractorNo);
    }

    if (filter.operatorName) {
      records = records.filter(r => r.operatorName.includes(filter.operatorName!));
    }

    if (filter.isBilled !== undefined) {
      records = records.filter(r => r.isBilled === filter.isBilled);
    }

    return records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getRecordById(id: string): WorkRecord | undefined {
    return dataStore.getRecordById(id);
  }

  getRecordByRecordNo(recordNo: string): WorkRecord | undefined {
    return dataStore.getRecordByRecordNo(recordNo);
  }

  generateReport(filter: QueryFilter, operator: string): ReportData {
    const records = this.queryRecords(filter);

    const summary = {
      totalRecords: records.length,
      totalAmount: records.reduce((sum, r) => sum + r.finalAmount, 0),
      validRecords: records.filter(r => r.status === 'valid').length,
      invalidRecords: records.filter(r => r.status === 'invalid').length,
      billedRecords: records.filter(r => r.isBilled).length,
      pendingRecords: records.filter(r => r.status === 'pending').length,
      totalExceptions: records.reduce((sum, r) => sum + r.exceptions.length, 0),
    };

    const report: ReportData = {
      summary,
      records,
      generatedAt: new Date(),
      generatedBy: operator,
      filters: filter,
    };

    dataStore.addAuditLog('generate_report', operator, {
      filter,
      recordCount: records.length,
    });

    return report;
  }

  exportToCSV(report: ReportData, filePath: string): void {
    const records = report.records.map(r => ({
      记录编号: r.recordNo,
      操作人: r.operator,
      拖拉机号: r.tractorNo,
      机手姓名: r.operatorName,
      开始时间: r.startTime.toISOString(),
      结束时间: r.endTime.toISOString(),
      工作小时: r.workHours,
      作业面积: r.workArea,
      油耗: r.fuelConsumption,
      计费类型: r.billingType,
      小时单价: r.hourlyRate,
      面积单价: r.areaRate,
      油价: r.fuelRate,
      最低收费: r.minimumCharge,
      状态: this.getStatusText(r.status),
      计算金额: r.calculatedAmount,
      最终金额: r.finalAmount,
      是否已结算: r.isBilled ? '是' : '否',
      结算时间: r.billedAt?.toISOString() || '',
      异常数量: r.exceptions.length,
      异常信息: r.exceptions.map(e => `${e.type}: ${e.message}`).join('; '),
      创建时间: r.createdAt.toISOString(),
      创建人: r.createdBy,
    }));

    const parser = new Parser();
    const csv = parser.parse(records);
    fs.writeFileSync(filePath, csv, 'utf-8');

    dataStore.addAuditLog('export_csv', report.generatedBy, {
      filePath,
      recordCount: records.length,
    });
  }

  exportToJSON(report: ReportData, filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    dataStore.addAuditLog('export_json', report.generatedBy, {
      filePath,
      recordCount: report.records.length,
    });
  }

  private getStatusText(status: RecordStatus): string {
    const statusMap: Record<RecordStatus, string> = {
      pending: '待处理',
      valid: '有效',
      invalid: '无效',
      billed: '已结算',
      reviewed: '已复核',
    };
    return statusMap[status] || status;
  }

  getStatistics(filter?: QueryFilter) {
    const records = filter ? this.queryRecords(filter) : dataStore.getAllRecords();

    return {
      totalRecords: records.length,
      totalAmount: records.reduce((sum, r) => sum + r.finalAmount, 0),
      byStatus: this.groupByStatus(records),
      byBillingType: this.groupByBillingType(records),
      byOperator: this.groupByOperator(records),
    };
  }

  private groupByStatus(records: WorkRecord[]) {
    return records.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByBillingType(records: WorkRecord[]) {
    return records.reduce((acc, r) => {
      acc[r.billingType] = (acc[r.billingType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByOperator(records: WorkRecord[]) {
    return records.reduce((acc, r) => {
      acc[r.operator] = (acc[r.operator] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const queryService = new QueryService();
