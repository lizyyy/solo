import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { ReconciliationResult, Discrepancy, TraceLink } from '../types';
import { store } from '../models/Store';
import { reviewService } from './ReviewService';

export class ReportService {
  async exportReportToExcel(
    reportId: string,
    outputPath?: string
  ): Promise<{
    success: boolean;
    filePath: string;
    filename: string;
  }> {
    const report = reviewService.recalculateReportSummary(reportId);
    if (!report) {
      throw new Error(`对账报告 ${reportId} 不存在`);
    }

    const discrepancies = report.discrepancies
      .map(id => store.getDiscrepancy(id))
      .filter(Boolean) as Discrepancy[];

    const borrowRecords = store.getAllBorrowRecords();
    const vehicles = store.getAllVehicles();
    const violations = store.getAllViolations();

    const filename = `对账报告_${report.reconciliationId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = outputPath || path.join(process.cwd(), 'data', filename);

    const workbook = XLSX.utils.book_new();

    const summaryData = this.generateSummarySheetData(report, discrepancies);
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, '对账汇总');

    const discrepancyData = this.generateDiscrepancySheetData(discrepancies);
    const discrepancySheet = XLSX.utils.json_to_sheet(discrepancyData);
    XLSX.utils.book_append_sheet(workbook, discrepancySheet, '差异明细');

    const borrowData = this.generateBorrowSheetData(borrowRecords);
    const borrowSheet = XLSX.utils.json_to_sheet(borrowData);
    XLSX.utils.book_append_sheet(workbook, borrowSheet, '借还记录');

    const vehicleData = this.generateVehicleSheetData(vehicles);
    const vehicleSheet = XLSX.utils.json_to_sheet(vehicleData);
    XLSX.utils.book_append_sheet(workbook, vehicleSheet, '车辆信息');

    const violationData = this.generateViolationSheetData(violations);
    const violationSheet = XLSX.utils.json_to_sheet(violationData);
    XLSX.utils.book_append_sheet(workbook, violationSheet, '违章记录');

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(workbook, filePath);

    return {
      success: true,
      filePath,
      filename
    };
  }

  private generateSummarySheetData(report: ReconciliationResult, discrepancies: Discrepancy[]): any[] {
    return [
      { '项目': '对账编号', '值': report.reconciliationId },
      { '项目': '对账周期开始', '值': report.period.start.toLocaleString() },
      { '项目': '对账周期结束', '值': report.period.end.toLocaleString() },
      { '项目': '生成时间', '值': report.generatedAt.toLocaleString() },
      { '项目': '报告状态', '值': report.status },
      { '项目': '', '值': '' },
      { '项目': '汇总统计', '值': '' },
      { '项目': '借还记录总数', '值': report.summary.totalBorrowRecords },
      { '项目': '超时未还数量', '值': report.summary.overdueReturns },
      { '项目': '车辆总数', '值': report.summary.totalVehicles },
      { '项目': '油卡异常数量', '值': report.summary.fuelCardAbnormalities },
      { '项目': '违章记录总数', '值': report.summary.totalViolations },
      { '项目': '未归属违章数', '值': report.summary.unassignedViolations },
      { '项目': '差异总数', '值': report.summary.totalDiscrepancies },
      { '项目': '已解决差异数', '值': report.summary.resolvedDiscrepancies },
      { '项目': '罚款总金额', '值': `¥${report.summary.totalFineAmount}` },
      { '项目': '', '值': '' },
      { '项目': '差异分类统计', '值': '' },
      { '项目': '超时归还', '值': discrepancies.filter(d => d.type === 'overdue_return').length },
      { '项目': '油卡余额异常', '值': discrepancies.filter(d => d.type === 'fuel_card_balance').length },
      { '项目': '违章归属问题', '值': discrepancies.filter(d => d.type === 'violation_ownership').length },
      { '项目': '里程异常', '值': discrepancies.filter(d => d.type === 'mileage_abnormal').length },
      { '项目': '', '值': '' },
      { '项目': '严重程度统计', '值': '' },
      { '项目': '高', '值': discrepancies.filter(d => d.severity === 'high').length },
      { '项目': '中', '值': discrepancies.filter(d => d.severity === 'medium').length },
      { '项目': '低', '值': discrepancies.filter(d => d.severity === 'low').length }
    ];
  }

  private generateDiscrepancySheetData(discrepancies: Discrepancy[]): any[] {
    return discrepancies.map(d => ({
      '差异ID': d.id,
      '类型': this.translateType(d.type),
      '严重程度': this.translateSeverity(d.severity),
      '描述': d.description,
      '状态': this.translateStatus(d.status),
      '检测时间': d.detectedAt.toLocaleString(),
      '审核人': d.reviewedBy || '',
      '审核时间': d.reviewedAt?.toLocaleString() || '',
      '解决方案': d.resolution || ''
    }));
  }

  private generateBorrowSheetData(records: any[]): any[] {
    return records.map(r => ({
      '记录ID': r.recordId,
      '车牌号': r.vehiclePlate,
      '借用人': r.borrower,
      '部门': r.borrowerDepartment,
      '借出时间': r.borrowTime.toLocaleString(),
      '预计归还时间': r.expectedReturnTime.toLocaleString(),
      '实际归还时间': r.actualReturnTime?.toLocaleString() || '未归还',
      '借出里程': r.borrowMileage,
      '归还里程': r.returnMileage || '',
      '油卡ID': r.fuelCardId || '',
      '借出油卡余额': r.fuelBalanceBefore,
      '归还油卡余额': r.fuelBalanceAfter || '',
      '状态': r.status,
      '备注': r.remarks || ''
    }));
  }

  private generateVehicleSheetData(vehicles: any[]): any[] {
    return vehicles.map(v => ({
      '车辆ID': v.vehicleId,
      '车牌号': v.plateNumber,
      '品牌': v.brand,
      '型号': v.model,
      '颜色': v.color,
      'VIN': v.vin,
      '当前里程': v.currentMileage,
      '油卡ID': v.fuelCardId,
      '油卡余额': v.fuelCardBalance,
      '钥匙数量': v.keyCount,
      '状态': v.status,
      '指定销售': v.assignedSalesperson || '',
      '购买日期': v.purchaseDate.toLocaleString().split(' ')[0],
      '备注': v.remarks || ''
    }));
  }

  private generateViolationSheetData(violations: any[]): any[] {
    return violations.map(v => ({
      '违章ID': v.violationId,
      '车牌号': v.vehiclePlate,
      '违章时间': v.violationTime.toLocaleString(),
      '违章类型': v.violationType,
      '违章地点': v.violationLocation,
      '扣分': v.points,
      '罚款金额': v.fineAmount,
      '状态': v.status,
      '驾驶人': v.driverName || '',
      '处理时间': v.processedTime?.toLocaleString() || '',
      '来源': v.source,
      '备注': v.remarks || ''
    }));
  }

  private translateType(type: string): string {
    const map: Record<string, string> = {
      'overdue_return': '超时归还',
      'fuel_card_balance': '油卡余额异常',
      'violation_ownership': '违章归属问题',
      'mileage_abnormal': '里程异常',
      'key_missing': '钥匙缺失'
    };
    return map[type] || type;
  }

  private translateSeverity(severity: string): string {
    const map: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return map[severity] || severity;
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      'open': '待处理',
      'reviewed': '已审核',
      'resolved': '已解决'
    };
    return map[status] || status;
  }

  getTraceabilityChain(recordId: string): {
    record: any;
    relatedRecords: any[];
    chain: TraceLink[];
    reportInfo?: any;
  } {
    const record = this.findRecordById(recordId);
    if (!record) {
      throw new Error(`记录 ${recordId} 不存在`);
    }

    const chain = store.getTraceChain(recordId);
    const relatedRecords = this.findRelatedRecords(record);

    const reportInfo = this.findRelatedReport(recordId);

    return {
      record,
      relatedRecords,
      chain,
      reportInfo
    };
  }

  private findRecordById(recordId: string): any {
    const borrow = store.getBorrowRecord(recordId);
    if (borrow) return { type: 'borrow', data: borrow };

    const vehicle = store.getVehicle(recordId);
    if (vehicle) return { type: 'vehicle', data: vehicle };

    const violation = store.getViolation(recordId);
    if (violation) return { type: 'violation', data: violation };

    const discrepancy = store.getDiscrepancy(recordId);
    if (discrepancy) return { type: 'discrepancy', data: discrepancy };

    const report = store.getReconciliation(recordId);
    if (report) return { type: 'report', data: report };

    return null;
  }

  private findRelatedRecords(record: { type: string; data: any }): any[] {
    const related: any[] = [];

    switch (record.type) {
      case 'borrow':
        const vehicle = store.getVehicleByPlate(record.data.vehiclePlate);
        if (vehicle) related.push({ type: 'vehicle', data: vehicle });
        
        const violations = store.getViolationsByPlate(record.data.vehiclePlate).filter(v => {
          const borrowTime = new Date(record.data.borrowTime);
          const returnTime = record.data.actualReturnTime ? new Date(record.data.actualReturnTime) : new Date();
          return v.violationTime >= borrowTime && v.violationTime <= returnTime;
        });
        violations.forEach(v => related.push({ type: 'violation', data: v }));
        break;

      case 'vehicle':
        const vehicleBorrows = store.getAllBorrowRecords().filter(
          b => b.vehiclePlate === record.data.plateNumber
        );
        vehicleBorrows.forEach(b => related.push({ type: 'borrow', data: b }));
        
        const vehicleViolations = store.getViolationsByPlate(record.data.plateNumber);
        vehicleViolations.forEach(v => related.push({ type: 'violation', data: v }));
        break;

      case 'violation':
        const violationBorrows = store.getAllBorrowRecords().filter(b => {
          if (b.vehiclePlate !== record.data.vehiclePlate) return false;
          const borrowTime = new Date(b.borrowTime);
          const returnTime = b.actualReturnTime ? new Date(b.actualReturnTime) : new Date();
          return record.data.violationTime >= borrowTime && record.data.violationTime <= returnTime;
        });
        violationBorrows.forEach(b => related.push({ type: 'borrow', data: b }));
        break;

      case 'discrepancy':
        const sourceRecord = this.findRecordById(record.data.sourceRecordId);
        if (sourceRecord) related.push(sourceRecord);
        
        record.data.relatedRecordIds.forEach((id: string) => {
          const r = this.findRecordById(id);
          if (r) related.push(r);
        });
        break;
    }

    return related;
  }

  private findRelatedReport(recordId: string): any {
    const reports = store.getAllReconciliations();
    
    for (const report of reports) {
      if (report.discrepancies.includes(recordId)) {
        return {
          id: report.id,
          reconciliationId: report.reconciliationId,
          period: report.period,
          generatedAt: report.generatedAt,
          status: report.status
        };
      }
    }

    for (const report of reports) {
      for (const dId of report.discrepancies) {
        const d = store.getDiscrepancy(dId);
        if (d && d.sourceRecordId === recordId) {
          return {
            id: report.id,
            reconciliationId: report.reconciliationId,
            period: report.period,
            generatedAt: report.generatedAt,
            status: report.status,
            relatedDiscrepancyId: dId,
            discrepancyType: d.type
          };
        }
        if (d && d.relatedRecordIds.includes(recordId)) {
          return {
            id: report.id,
            reconciliationId: report.reconciliationId,
            period: report.period,
            generatedAt: report.generatedAt,
            status: report.status,
            relatedDiscrepancyId: dId,
            discrepancyType: d.type
          };
        }
      }
    }

    return null;
  }

  getAuditLog(recordId: string): any[] {
    const traceLinks = store.getTraceLinksByRecord(recordId);
    return traceLinks.map(link => ({
      time: link.timestamp,
      action: link.action,
      operator: link.operator,
      details: link.details
    })).sort((a, b) => b.time.getTime() - a.time.getTime());
  }
}

export const reportService = new ReportService();
