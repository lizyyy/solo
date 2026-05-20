import * as ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import * as fs from 'fs';
import * as path from 'path';
import { DataStore } from '../store/DataStore';
import {
  ReconciliationRecord,
  ReviewStatus,
  AttendanceStatus,
  DifferenceType
} from '../types';

export class ExportService {
  private store: DataStore;
  private exportDir: string;

  constructor() {
    this.store = DataStore.getInstance();
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureExportDir();
  }

  private ensureExportDir(): void {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async exportToExcel(reconciliationId: string): Promise<string> {
    const records = this.store.getReconciliationRecordsByReconciliationId(reconciliationId);
    const summary = this.store.getReconciliationSummary(reconciliationId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '司法社工对账系统';
    workbook.created = new Date();

    this.addSummarySheet(workbook, summary, reconciliationId);
    this.addDetailsSheet(workbook, records);
    this.addDifferencesSheet(workbook, records);

    const fileName = `对账报告_${reconciliationId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(this.exportDir, fileName);

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, summary: any, reconciliationId: string): void {
    const worksheet = workbook.addWorksheet('汇总');

    worksheet.columns = [
      { header: '统计项', key: 'item', width: 30 },
      { header: '数值', key: 'value', width: 15 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 14 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const summaryData = [
      { item: '对账编号', value: reconciliationId },
      { item: '对账日期', value: new Date().toLocaleDateString('zh-CN') },
      { item: '总记录数', value: summary.totalRecords },
      { item: '待复核', value: summary.pendingReview },
      { item: '已通过', value: summary.approved },
      { item: '已驳回', value: summary.rejected },
      { item: '需补材料', value: summary.needSupplement },
      { item: '', value: '' },
      { item: '差异总数', value: summary.totalDifferences },
      { item: '- 超时未签', value: summary.timeoutNoSign },
      { item: '- 请假覆盖', value: summary.leaveOverlap },
      { item: '- 轨迹缺口', value: summary.traceGap },
      { item: '- 定位异常', value: summary.locationAnomaly },
      { item: '- 人工修正', value: summary.manualCorrection },
      { item: '', value: '' },
      { item: 'A级人员异常', value: summary.levelABnormal },
      { item: 'B级人员异常', value: summary.levelBBnormal },
      { item: 'C级人员异常', value: summary.levelCBnormal }
    ];

    summaryData.forEach((item, index) => {
      const row = worksheet.addRow(item);
      if (item.item.includes('异常') || item.item === '差异总数') {
        row.font = { color: { argb: 'FFFF0000' } };
      }
    });
  }

  private addDetailsSheet(workbook: ExcelJS.Workbook, records: ReconciliationRecord[]): void {
    const worksheet = workbook.addWorksheet('明细');

    worksheet.columns = [
      { header: '人员等级', key: 'level', width: 10 },
      { header: '人员ID', key: 'personId', width: 15 },
      { header: '姓名', key: 'personName', width: 12 },
      { header: '日期', key: 'date', width: 12 },
      { header: '签到状态', key: 'attendanceStatus', width: 12 },
      { header: '签到时间', key: 'signInTime', width: 12 },
      { header: '签退时间', key: 'signOutTime', width: 12 },
      { header: '是否请假', key: 'hasLeave', width: 10 },
      { header: '定位状态', key: 'locationStatus', width: 15 },
      { header: '最终状态', key: 'finalStatus', width: 12 },
      { header: '复核状态', key: 'reviewStatus', width: 12 },
      { header: '差异数', key: 'diffCount', width: 8 },
      { header: '人工修正', key: 'manualCorrected', width: 10 },
      { header: '复核意见', key: 'reviewComment', width: 30 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    records.forEach(record => {
      const row = worksheet.addRow({
        level: record.personLevel,
        personId: record.personId,
        personName: record.personName,
        date: record.date,
        attendanceStatus: this.getStatusText(record.attendance?.status),
        signInTime: record.attendance?.signInTime || '-',
        signOutTime: record.attendance?.signOutTime || '-',
        hasLeave: record.leave ? '是' : '否',
        locationStatus: record.locationTrace ? 
          (record.locationTrace.anomalyCount > 0 ? `有${record.locationTrace.anomalyCount}个异常` : '正常') : '无数据',
        finalStatus: this.getStatusText(record.finalStatus),
        reviewStatus: this.getReviewStatusText(record.reviewStatus),
        diffCount: record.differences.length,
        manualCorrected: record.isManualCorrected ? '是' : '否',
        reviewComment: record.reviewComment || ''
      });

      if (record.differences.length > 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } };
      }
      if (record.isManualCorrected) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0FFE0' } };
      }
    });
  }

  private addDifferencesSheet(workbook: ExcelJS.Workbook, records: ReconciliationRecord[]): void {
    const worksheet = workbook.addWorksheet('差异详情');

    worksheet.columns = [
      { header: '对账编号', key: 'reconciliationId', width: 20 },
      { header: '人员等级', key: 'level', width: 10 },
      { header: '姓名', key: 'personName', width: 12 },
      { header: '日期', key: 'date', width: 12 },
      { header: '差异类型', key: 'diffType', width: 20 },
      { header: '差异描述', key: 'description', width: 60 },
      { header: '来源', key: 'source', width: 15 },
      { header: '严重程度', key: 'severity', width: 12 },
      { header: '证据', key: 'evidence', width: 40 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    records.forEach(record => {
      record.differences.forEach(diff => {
        worksheet.addRow({
          reconciliationId: record.reconciliationId,
          level: record.personLevel,
          personName: record.personName,
          date: record.date,
          diffType: this.getDiffTypeText(diff.type),
          description: diff.description,
          source: diff.source,
          severity: this.getSeverityText(diff.severity),
          evidence: diff.evidence || ''
        });
      });
    });
  }

  async exportToCSV(reconciliationId: string): Promise<string> {
    const records = this.store.getReconciliationRecordsByReconciliationId(reconciliationId);

    const data = records.map(record => ({
      人员等级: record.personLevel,
      人员ID: record.personId,
      姓名: record.personName,
      日期: record.date,
      签到状态: this.getStatusText(record.attendance?.status),
      签到时间: record.attendance?.signInTime || '-',
      签退时间: record.attendance?.signOutTime || '-',
      是否请假: record.leave ? '是' : '否',
      请假类型: record.leave?.leaveType || '-',
      请假原因: record.leave?.reason || '-',
      定位异常数: record.locationTrace?.anomalyCount || 0,
      最终状态: this.getStatusText(record.finalStatus),
      复核状态: this.getReviewStatusText(record.reviewStatus),
      差异数: record.differences.length,
      人工修正: record.isManualCorrected ? '是' : '否',
      修正原因: record.correctionReason || '',
      复核意见: record.reviewComment || ''
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    const fileName = `对账明细_${reconciliationId}_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    fs.writeFileSync(filePath, '\ufeff' + csv, 'utf-8');
    return filePath;
  }

  private getStatusText(status?: AttendanceStatus): string {
    if (!status) return '-';
    const statusMap: Record<AttendanceStatus, string> = {
      [AttendanceStatus.NORMAL]: '正常',
      [AttendanceStatus.LATE]: '迟到',
      [AttendanceStatus.ABSENT]: '缺勤',
      [AttendanceStatus.LEAVE]: '请假',
      [AttendanceStatus.EXCEPTION]: '异常'
    };
    return statusMap[status] || status;
  }

  private getReviewStatusText(status: ReviewStatus): string {
    const statusMap: Record<ReviewStatus, string> = {
      [ReviewStatus.PENDING]: '待复核',
      [ReviewStatus.APPROVED]: '已通过',
      [ReviewStatus.REJECTED]: '已驳回',
      [ReviewStatus.NEED_SUPPLEMENT]: '需补材料'
    };
    return statusMap[status] || status;
  }

  private getDiffTypeText(type: DifferenceType): string {
    const typeMap: Record<DifferenceType, string> = {
      [DifferenceType.TIMEOUT_NO_SIGN]: '超时未签',
      [DifferenceType.LEAVE_OVERLAP]: '请假覆盖',
      [DifferenceType.TRACE_GAP]: '轨迹缺口',
      [DifferenceType.LOCATION_ANOMALY]: '定位异常',
      [DifferenceType.MANUAL_CORRECTION]: '人工修正'
    };
    return typeMap[type] || type;
  }

  private getSeverityText(severity: string): string {
    const severityMap: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高'
    };
    return severityMap[severity] || severity;
  }

  getExportDir(): string {
    return this.exportDir;
  }
}
