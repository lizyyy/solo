import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationBatch,
  ReconciliationDetail,
  ReconciliationSummary,
  DiscrepancyType
} from '../models/types';
import dataStore from '../store/dataStore';
import reconciliationService from './reconciliationService';

export type ReportFormat = 'xlsx' | 'pdf' | 'csv';

export class ReportService {
  private reportDir: string;

  constructor() {
    this.reportDir = path.join(process.cwd(), 'reports');
    this.ensureReportDir();
  }

  private ensureReportDir(): void {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async generateReport(
    batchId: string,
    format: ReportFormat
  ): Promise<{ filePath: string; fileName: string }> {
    const batch = dataStore.getBatch(batchId);
    if (!batch) {
      throw new Error('对账批次不存在');
    }

    const details = dataStore.getDetailsByBatch(batchId);
    const summary = reconciliationService.getSummary(batchId);

    if (!summary) {
      throw new Error('无法获取汇总数据');
    }

    const fileName = `${batch.month}月对账报告_${Date.now()}.${format}`;
    const filePath = path.join(this.reportDir, fileName);

    switch (format) {
      case 'xlsx':
        await this.generateExcelReport(filePath, batch, details, summary);
        break;
      case 'csv':
        await this.generateCsvReport(filePath, batch, details, summary);
        break;
      case 'pdf':
        await this.generatePdfReport(filePath, batch, details, summary);
        break;
    }

    return { filePath, fileName };
  }

  private async generateExcelReport(
    filePath: string,
    batch: ReconciliationBatch,
    details: ReconciliationDetail[],
    summary: ReconciliationSummary
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '学校后勤对账系统';
    workbook.created = new Date();

    this.addSummarySheet(workbook, batch, summary);
    this.addDetailsSheet(workbook, details);
    this.addDiscrepanciesSheet(workbook, details);

    await workbook.xlsx.writeFile(filePath);
  }

  private addSummarySheet(
    workbook: ExcelJS.Workbook,
    batch: ReconciliationBatch,
    summary: ReconciliationSummary
  ): void {
    const sheet = workbook.addWorksheet('汇总');

    sheet.columns = [
      { header: '项目', key: 'item', width: 30 },
      { header: '数值', key: 'value', width: 25 },
      { header: '说明', key: 'note', width: 40 }
    ];

    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const data: { item: string; value: string | number; note: string }[] = [
      { item: '对账月份', value: batch.month, note: '' },
      { item: '批次名称', value: batch.name, note: '' },
      { item: '创建时间', value: batch.createdAt.toLocaleString('zh-CN'), note: '' },
      { item: '对账状态', value: this.getStatusText(batch.status), note: '' },
      { item: '', value: '', note: '' },
      { item: '【统计信息】', value: '', note: '' },
      { item: '学生总数', value: summary.statistics.totalStudents, note: '人' },
      { item: '有补贴学生', value: summary.statistics.withSubsidy, note: '人' },
      { item: '无补贴学生', value: summary.statistics.withoutSubsidy, note: '人' },
      { item: '对账通过', value: summary.statistics.matched, note: '人' },
      { item: '存在差异', value: summary.statistics.withDiscrepancy, note: '人' },
      { item: '已复核', value: summary.statistics.reviewed, note: '人' },
      { item: '', value: '', note: '' },
      { item: '【金额汇总】', value: '', note: '' },
      { item: '补贴总额度', value: `¥${summary.amounts.totalSubsidyLimit.toFixed(2)}`, note: '' },
      { item: '刷卡总金额', value: `¥${summary.amounts.totalSwipe.toFixed(2)}`, note: '' },
      { item: '退餐总金额', value: `¥${summary.amounts.totalRefund.toFixed(2)}`, note: '' },
      { item: '可补贴金额', value: `¥${summary.amounts.totalEligible.toFixed(2)}`, note: '最终应发放金额' },
      { item: '不可补贴金额', value: `¥${summary.amounts.totalIneligible.toFixed(2)}`, note: '需学生自费部分' },
      { item: '应拨付金额', value: `¥${summary.amounts.toBePaid.toFixed(2)}`, note: '' },
      { item: '', value: '', note: '' },
      { item: '【差异类型统计】', value: '', note: '' }
    ];

    for (const d of summary.discrepancyBreakdown) {
      data.push({
        item: this.getDiscrepancyText(d.type),
        value: `${d.count}笔`,
        note: `涉及金额 ¥${d.totalAmount.toFixed(2)}`
      });
    }

    sheet.addRows(data);

    sheet.eachRow((row, rowNumber) => {
      if (row.getCell('item').toString().startsWith('【')) {
        row.font = { bold: true, size: 12 };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F8FF' } };
      }
    });
  }

  private addDetailsSheet(
    workbook: ExcelJS.Workbook,
    details: ReconciliationDetail[]
  ): void {
    const sheet = workbook.addWorksheet('明细');

    sheet.columns = [
      { header: '学号', key: 'studentId', width: 15 },
      { header: '姓名', key: 'studentName', width: 12 },
      { header: '补贴类型', key: 'subsidyType', width: 15 },
      { header: '月度补贴上限', key: 'subsidyLimit', width: 15 },
      { header: '刷卡总金额', key: 'swipeAmount', width: 15 },
      { header: '退餐总金额', key: 'refundAmount', width: 15 },
      { header: '净消费', key: 'netAmount', width: 15 },
      { header: '可补贴金额', key: 'eligibleAmount', width: 15 },
      { header: '最终补贴金额', key: 'finalAmount', width: 15 },
      { header: '状态', key: 'status', width: 12 },
      { header: '差异数', key: 'discrepancyCount', width: 10 },
      { header: '说明', key: 'explanation', width: 60 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    for (const detail of details) {
      sheet.addRow({
        studentId: detail.studentId,
        studentName: detail.studentName,
        subsidyType: detail.subsidyRecord?.subsidyType || '无',
        subsidyLimit: detail.totalSubsidyLimit,
        swipeAmount: detail.totalSwipeAmount,
        refundAmount: detail.totalRefundAmount,
        netAmount: detail.netAmount,
        eligibleAmount: detail.eligibleAmount,
        finalAmount: detail.finalAmount,
        status: this.getStatusText(detail.status),
        discrepancyCount: detail.discrepancies.length,
        explanation: detail.finalExplanation
      });
    }
  }

  private addDiscrepanciesSheet(
    workbook: ExcelJS.Workbook,
    details: ReconciliationDetail[]
  ): void {
    const sheet = workbook.addWorksheet('差异详情');

    sheet.columns = [
      { header: '学号', key: 'studentId', width: 12 },
      { header: '姓名', key: 'studentName', width: 12 },
      { header: '差异类型', key: 'type', width: 18 },
      { header: '严重程度', key: 'severity', width: 12 },
      { header: '描述', key: 'description', width: 20 },
      { header: '期望值', key: 'expected', width: 12 },
      { header: '实际值', key: 'actual', width: 12 },
      { header: '差额', key: 'difference', width: 12 },
      { header: '详细说明', key: 'explanation', width: 60 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    for (const detail of details) {
      for (const d of detail.discrepancies) {
        sheet.addRow({
          studentId: detail.studentId,
          studentName: detail.studentName,
          type: this.getDiscrepancyText(d.type),
          severity: this.getSeverityText(d.severity),
          description: d.description,
          expected: d.expectedValue?.toFixed(2) || '-',
          actual: d.actualValue?.toFixed(2) || '-',
          difference: d.difference?.toFixed(2) || '-',
          explanation: d.detailedExplanation
        });
      }
    }
  }

  private async generateCsvReport(
    filePath: string,
    batch: ReconciliationBatch,
    details: ReconciliationDetail[],
    summary: ReconciliationSummary
  ): Promise<void> {
    const lines: string[] = [];

    lines.push('# 汇总信息');
    lines.push(`对账月份,${batch.month}`);
    lines.push(`批次名称,${batch.name}`);
    lines.push(`学生总数,${summary.statistics.totalStudents}`);
    lines.push(`可补贴金额,${summary.amounts.totalEligible.toFixed(2)}`);
    lines.push('');

    lines.push('# 明细信息');
    lines.push(['学号', '姓名', '补贴上限', '刷卡金额', '退餐金额', '净消费', '最终补贴', '状态', '说明'].join(','));

    for (const detail of details) {
      lines.push([
        detail.studentId,
        detail.studentName,
        detail.totalSubsidyLimit.toFixed(2),
        detail.totalSwipeAmount.toFixed(2),
        detail.totalRefundAmount.toFixed(2),
        detail.netAmount.toFixed(2),
        detail.finalAmount.toFixed(2),
        this.getStatusText(detail.status),
        `"${detail.finalExplanation.replace(/"/g, '""')}"`
      ].join(','));
    }

    fs.writeFileSync(filePath, '\ufeff' + lines.join('\n'), 'utf8');
  }

  private async generatePdfReport(
    filePath: string,
    batch: ReconciliationBatch,
    details: ReconciliationDetail[],
    summary: ReconciliationSummary
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      doc.fontSize(20).text('学校后勤对账报告', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`${batch.month}月`, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(12).text(`生成时间：${new Date().toLocaleString('zh-CN')}`);
      doc.text(`批次名称：${batch.name}`);
      doc.text(`对账状态：${this.getStatusText(batch.status)}`);
      doc.moveDown();

      doc.fontSize(14).text('一、统计信息', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`学生总数：${summary.statistics.totalStudents}人`);
      doc.text(`有补贴学生：${summary.statistics.withSubsidy}人`);
      doc.text(`对账通过：${summary.statistics.matched}人`);
      doc.text(`存在差异：${summary.statistics.withDiscrepancy}人`);
      doc.moveDown();

      doc.fontSize(14).text('二、金额汇总', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`补贴总额度：¥${summary.amounts.totalSubsidyLimit.toFixed(2)}`);
      doc.text(`刷卡总金额：¥${summary.amounts.totalSwipe.toFixed(2)}`);
      doc.text(`退餐总金额：¥${summary.amounts.totalRefund.toFixed(2)}`);
      doc.text(`可补贴金额：¥${summary.amounts.totalEligible.toFixed(2)}`);
      doc.text(`不可补贴金额：¥${summary.amounts.totalIneligible.toFixed(2)}`);
      doc.moveDown();

      if (summary.discrepancyBreakdown.length > 0) {
        doc.fontSize(14).text('三、差异统计', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11);
        for (const d of summary.discrepancyBreakdown) {
          doc.text(`• ${this.getDiscrepancyText(d.type)}：${d.count}笔，涉及¥${d.totalAmount.toFixed(2)}`);
        }
        doc.moveDown();
      }

      doc.fontSize(14).text('四、明细列表', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);

      for (const detail of details) {
        doc.text(`【${detail.studentId}】${detail.studentName} - 最终补贴：¥${detail.finalAmount.toFixed(2)}`);
        doc.fontSize(9).text(`  ${detail.finalExplanation}`);
        doc.fontSize(10);
        doc.moveDown(0.3);
      }

      doc.end();
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private getStatusText(status: string): string {
    const map: Record<string, string> = {
      'importing': '导入中',
      'processing': '处理中',
      'reviewing': '复核中',
      'completed': '已完成',
      'pending': '待处理',
      'matched': '已匹配',
      'discrepancy': '存在差异',
      'reviewed': '已复核',
      'approved': '已通过',
      'rejected': '已驳回'
    };
    return map[status] || status;
  }

  private getDiscrepancyText(type: DiscrepancyType): string {
    const map: Record<DiscrepancyType, string> = {
      'subsidy_limit_exceeded': '补贴上限超出',
      'duplicate_claim': '疑似重复刷卡',
      'refund_return': '退餐无对应消费',
      'no_subsidy_record': '有消费无补贴记录',
      'no_swipe_record': '有补贴无消费记录',
      'amount_mismatch': '金额不匹配',
      'date_out_of_range': '日期超出范围'
    };
    return map[type] || type;
  }

  private getSeverityText(severity: string): string {
    const map: Record<string, string> = {
      'low': '低',
      'medium': '中',
      'high': '高'
    };
    return map[severity] || severity;
  }
}

export default new ReportService();
