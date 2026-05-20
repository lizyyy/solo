import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationResult,
  ReportData,
  Case,
  BorrowRecord,
  UserPermission,
  ClassificationLevel,
  Discrepancy,
  ReviewLog
} from '../types';
import { ReconciliationEngine } from './ReconciliationEngine';
import { ReviewService } from './ReviewService';

export class ReportService {
  private engine: ReconciliationEngine;
  private reviewService: ReviewService;

  constructor(engine: ReconciliationEngine, reviewService: ReviewService) {
    this.engine = engine;
    this.reviewService = reviewService;
  }

  generateReportData(periodStart?: string, periodEnd?: string): ReportData {
    const result = this.reviewService.recalculateReconciliation();

    const details = this.engine.getAllBorrowRecords().map(record => {
      const caseInfo = this.engine.getCaseInfo(record.caseId);
      const recordDiscrepancies = result.discrepancies.filter(d => d.recordId === record.recordId);
      const isReviewed = result.reviewedRecords.includes(record.recordId);

      return {
        caseId: record.caseId,
        caseNumber: caseInfo?.caseNumber || '未知',
        caseTitle: caseInfo?.title || '未知案件',
        classification: caseInfo?.classification || ClassificationLevel.PUBLIC,
        borrower: record.borrowerName,
        borrowDate: record.borrowDate,
        dueDate: record.dueDate,
        status: this.getStatusText(record.status),
        issues: recordDiscrepancies.map(d => d.description),
        reviewStatus: isReviewed ? '已复核' : '待复核'
      };
    });

    return {
      reconciliationId: result.reconciliationId,
      generatedAt: new Date().toISOString(),
      period: {
        start: periodStart || this.getMinDate(),
        end: periodEnd || new Date().toISOString().split('T')[0]
      },
      summary: {
        totalBorrowed: details.length,
        returned: details.filter(d => d.status === '已归还').length,
        overdue: details.filter(d => d.issues.some(i => i.includes('超期'))).length,
        pendingReview: details.filter(d => d.reviewStatus === '待复核').length
      },
      discrepancies: result.discrepancies,
      reviewLogs: this.reviewService.getReviewLogs(),
      details
    };
  }

  async generatePDFReport(): Promise<Buffer> {
    const reportData = this.generateReportData();
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));

    this.renderPDFHeader(doc, reportData);
    this.renderPDFSummary(doc, reportData);
    this.renderPDFDiscrepancies(doc, reportData);
    this.renderPDFDetails(doc, reportData);
    this.renderPDFReviewLogs(doc, reportData);

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  async generateExcelReport(): Promise<Buffer> {
    const reportData = this.generateReportData();
    const workbook = new ExcelJS.Workbook();

    this.addSummarySheet(workbook, reportData);
    this.addDiscrepanciesSheet(workbook, reportData);
    this.addDetailsSheet(workbook, reportData);
    this.addReviewLogsSheet(workbook, reportData);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer as Buffer;
  }

  private renderPDFHeader(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    doc.fontSize(20).text('档案室借阅对账报告', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`报告编号: ${reportData.reconciliationId}`);
    doc.text(`生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}`);
    doc.text(`统计周期: ${reportData.period.start} 至 ${reportData.period.end}`);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
  }

  private renderPDFSummary(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    doc.fontSize(16).text('一、汇总统计');
    doc.moveDown();
    doc.fontSize(12);

    const summary = reportData.summary;
    doc.text(`总借阅记录数: ${summary.totalBorrowed}`);
    doc.text(`已归还数: ${summary.returned}`);
    doc.text(`超期未还数: ${summary.overdue}`, {
      fill: summary.overdue > 0 ? 'red' : 'black'
    });
    doc.text(`待复核数: ${summary.pendingReview}`, {
      fill: summary.pendingReview > 0 ? 'orange' : 'black'
    });

    doc.moveDown();
    const reviewSummary = this.reviewService.getReviewSummary();
    doc.text(`复核统计: 已复核${reviewSummary.totalReviewed}条, 批准${reviewSummary.approved}条, 退回${reviewSummary.rejected}条, 需补材料${reviewSummary.needsInfo}条`);
    doc.moveDown();
  }

  private renderPDFDiscrepancies(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    if (reportData.discrepancies.length === 0) return;

    doc.fontSize(16).text('二、异常记录');
    doc.moveDown();
    doc.fontSize(12);

    const grouped = this.groupBy(reportData.discrepancies, 'type');

    for (const [type, items] of Object.entries(grouped)) {
      doc.fontSize(14).text(this.getDiscrepancyTypeName(type as any));
      doc.moveDown(0.5);

      items.forEach((d: Discrepancy, index: number) => {
        const caseInfo = this.engine.getCaseInfo(d.caseId);
        doc.fontSize(11);
        doc.text(`${index + 1}. 案件: ${caseInfo?.caseNumber || '未知'} - ${caseInfo?.title || '未知'}`, {
          continued: true
        });
        doc.text(` | 严重程度: ${this.getSeverityText(d.severity)}`, {
          fill: d.severity === 'high' ? 'red' : d.severity === 'medium' ? 'orange' : 'black'
        });
        doc.text(`   问题: ${d.description}`);
        doc.text(`   说明: ${d.explanation}`);
        doc.text(`   状态: ${d.isResolved ? '已解决' : '未解决'}`, {
          fill: d.isResolved ? 'green' : 'red'
        });
        doc.moveDown(0.5);
      });

      doc.moveDown();
    }
  }

  private renderPDFDetails(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    doc.addPage();
    doc.fontSize(16).text('三、借阅明细');
    doc.moveDown();
    doc.fontSize(10);

    const tableTop = doc.y;
    const headers = ['案件编号', '标题', '密级', '借阅人', '借出日期', '应还日期', '状态', '问题', '复核状态'];
    const colWidths = [70, 100, 40, 50, 60, 60, 40, 80, 50];

    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: 'center' });
      x += colWidths[i];
    });

    let y = tableTop + 20;
    reportData.details.forEach((row) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      doc.fontSize(8);
      doc.text(row.caseNumber, x, y, { width: colWidths[0] }); x += colWidths[0];
      doc.text(row.caseTitle.substring(0, 15), x, y, { width: colWidths[1] }); x += colWidths[1];
      doc.text(this.getClassificationName(row.classification), x, y, { width: colWidths[2] }); x += colWidths[2];
      doc.text(row.borrower.substring(0, 8), x, y, { width: colWidths[3] }); x += colWidths[3];
      doc.text(row.borrowDate, x, y, { width: colWidths[4] }); x += colWidths[4];
      doc.text(row.dueDate, x, y, { width: colWidths[5] }); x += colWidths[5];
      doc.text(row.status, x, y, { width: colWidths[6] }); x += colWidths[6];
      doc.text(row.issues.length > 0 ? '有问题' : '正常', x, y, {
        width: colWidths[7],
        fill: row.issues.length > 0 ? 'red' : 'black'
      }); x += colWidths[7];
      doc.text(row.reviewStatus, x, y, {
        width: colWidths[8],
        fill: row.reviewStatus === '已复核' ? 'green' : 'orange'
      });

      y += 15;
    });

    doc.moveDown();
  }

  private renderPDFReviewLogs(doc: PDFKit.PDFDocument, reportData: ReportData): void {
    if (reportData.reviewLogs.length === 0) return;

    doc.addPage();
    doc.fontSize(16).text('四、复核记录');
    doc.moveDown();
    doc.fontSize(10);

    reportData.reviewLogs.forEach((log: ReviewLog) => {
      const record = this.engine.getBorrowRecord(log.recordId);
      const caseInfo = record ? this.engine.getCaseInfo(record.caseId) : undefined;

      doc.text(`案件: ${caseInfo?.caseNumber || '未知'} - ${caseInfo?.title?.substring(0, 20) || '未知'}`);
      doc.text(`复核人: ${log.reviewerName} | 时间: ${new Date(log.timestamp).toLocaleString('zh-CN')}`);
      doc.text(`操作: ${this.getActionText(log.action)}`);
      doc.text(`备注: ${log.comment}`);
      if (log.previousStatus || log.newStatus) {
        doc.text(`状态变更: ${this.getStatusText(log.previousStatus!)} → ${this.getStatusText(log.newStatus!)}`);
      }
      doc.moveDown(0.5);
    });
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, reportData: ReportData): void {
    const sheet = workbook.addWorksheet('汇总');

    sheet.addRow(['档案室借阅对账报告']);
    sheet.addRow(['报告编号', reportData.reconciliationId]);
    sheet.addRow(['生成时间', new Date(reportData.generatedAt).toLocaleString('zh-CN')]);
    sheet.addRow([]);

    sheet.addRow(['汇总统计']);
    sheet.addRow(['总借阅记录数', reportData.summary.totalBorrowed]);
    sheet.addRow(['已归还数', reportData.summary.returned]);
    sheet.addRow(['超期未还数', reportData.summary.overdue]);
    sheet.addRow(['待复核数', reportData.summary.pendingReview]);
    sheet.addRow([]);

    const reviewSummary = this.reviewService.getReviewSummary();
    sheet.addRow(['复核统计']);
    sheet.addRow(['已复核', reviewSummary.totalReviewed]);
    sheet.addRow(['批准', reviewSummary.approved]);
    sheet.addRow(['退回', reviewSummary.rejected]);
    sheet.addRow(['需补材料', reviewSummary.needsInfo]);
    sheet.addRow(['人工修正', reviewSummary.manualCorrections]);
  }

  private addDiscrepanciesSheet(workbook: ExcelJS.Workbook, reportData: ReportData): void {
    const sheet = workbook.addWorksheet('异常记录');

    sheet.columns = [
      { header: '差异类型', key: 'type', width: 20 },
      { header: '案件编号', key: 'caseNumber', width: 15 },
      { header: '案件标题', key: 'caseTitle', width: 30 },
      { header: '严重程度', key: 'severity', width: 10 },
      { header: '问题描述', key: 'description', width: 30 },
      { header: '详细说明', key: 'explanation', width: 50 },
      { header: '状态', key: 'status', width: 10 }
    ];

    reportData.discrepancies.forEach(d => {
      const caseInfo = this.engine.getCaseInfo(d.caseId);
      sheet.addRow({
        type: this.getDiscrepancyTypeName(d.type),
        caseNumber: caseInfo?.caseNumber || '未知',
        caseTitle: caseInfo?.title || '未知',
        severity: this.getSeverityText(d.severity),
        description: d.description,
        explanation: d.explanation,
        status: d.isResolved ? '已解决' : '未解决'
      });
    });
  }

  private addDetailsSheet(workbook: ExcelJS.Workbook, reportData: ReportData): void {
    const sheet = workbook.addWorksheet('借阅明细');

    sheet.columns = [
      { header: '案件编号', key: 'caseNumber', width: 15 },
      { header: '案件标题', key: 'caseTitle', width: 30 },
      { header: '密级', key: 'classification', width: 10 },
      { header: '借阅人', key: 'borrower', width: 15 },
      { header: '借出日期', key: 'borrowDate', width: 12 },
      { header: '应还日期', key: 'dueDate', width: 12 },
      { header: '状态', key: 'status', width: 10 },
      { header: '问题数', key: 'issueCount', width: 8 },
      { header: '复核状态', key: 'reviewStatus', width: 12 }
    ];

    reportData.details.forEach(row => {
      sheet.addRow({
        caseNumber: row.caseNumber,
        caseTitle: row.caseTitle,
        classification: this.getClassificationName(row.classification),
        borrower: row.borrower,
        borrowDate: row.borrowDate,
        dueDate: row.dueDate,
        status: row.status,
        issueCount: row.issues.length,
        reviewStatus: row.reviewStatus
      });
    });
  }

  private addReviewLogsSheet(workbook: ExcelJS.Workbook, reportData: ReportData): void {
    const sheet = workbook.addWorksheet('复核记录');

    sheet.columns = [
      { header: '案件编号', key: 'caseNumber', width: 15 },
      { header: '复核人', key: 'reviewer', width: 15 },
      { header: '复核时间', key: 'time', width: 20 },
      { header: '操作类型', key: 'action', width: 15 },
      { header: '备注', key: 'comment', width: 50 },
      { header: '原状态', key: 'prevStatus', width: 12 },
      { header: '新状态', key: 'newStatus', width: 12 }
    ];

    reportData.reviewLogs.forEach(log => {
      const record = this.engine.getBorrowRecord(log.recordId);
      const caseInfo = record ? this.engine.getCaseInfo(record.caseId) : undefined;

      sheet.addRow({
        caseNumber: caseInfo?.caseNumber || '未知',
        reviewer: log.reviewerName,
        time: new Date(log.timestamp).toLocaleString('zh-CN'),
        action: this.getActionText(log.action),
        comment: log.comment,
        prevStatus: this.getStatusText(log.previousStatus!),
        newStatus: this.getStatusText(log.newStatus!)
      });
    });
  }

  private getMinDate(): string {
    const records = this.engine.getAllBorrowRecords();
    if (records.length === 0) return new Date().toISOString().split('T')[0];
    return records.reduce((min, r) => r.borrowDate < min ? r.borrowDate : min, records[0].borrowDate);
  }

  private groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
    return arr.reduce((acc, item) => {
      const k = String(item[key]);
      if (!acc[k]) acc[k] = [];
      acc[k].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  private getStatusText(status?: string): string {
    const map: Record<string, string> = {
      'borrowed': '借阅中',
      'returned': '已归还',
      'extended': '已续借',
      'overdue': '超期'
    };
    return map[status || ''] || '未知';
  }

  private getDiscrepancyTypeName(type: string): string {
    const map: Record<string, string> = {
      'overdue': '超期未还',
      'classification_mismatch': '密级权限不匹配',
      'renewal_limit_exceeded': '续借次数超限',
      'permission_denied': '权限问题',
      'missing_record': '记录缺失',
      'date_conflict': '日期冲突'
    };
    return map[type] || type;
  }

  private getSeverityText(severity: string): string {
    const map: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };
    return map[severity] || severity;
  }

  private getClassificationName(classification: ClassificationLevel): string {
    const names: Record<ClassificationLevel, string> = {
      [ClassificationLevel.PUBLIC]: '公开',
      [ClassificationLevel.INTERNAL]: '内部',
      [ClassificationLevel.CONFIDENTIAL]: '机密',
      [ClassificationLevel.TOP_SECRET]: '绝密'
    };
    return names[classification];
  }

  private getActionText(action: string): string {
    const map: Record<string, string> = {
      'approved': '批准',
      'rejected': '退回',
      'needs_more_info': '需补材料',
      'manual_correction': '人工修正'
    };
    return map[action] || action;
  }
}
