import * as fs from 'fs';
import * as path from 'path';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import dayjs from 'dayjs';
import { ReconciliationRecord, ReconciliationSummary } from '../models/types';
import { dataStore } from '../models/store';

class ReportService {
  private reportsDir: string;

  constructor() {
    this.reportsDir = path.join(process.cwd(), 'reports');
    this.ensureReportsDirectory();
  }

  private ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  generateReconciliationCSV(record: ReconciliationRecord): string {
    const data = {
      申请编号: record.applicationNo,
      商户名称: record.merchantName,
      摊位位置: record.boothLocation,
      开始日期: record.startDate,
      结束日期: record.endDate,
      申请摊位费: record.boothFee,
      申请押金: record.depositAmount,
      实际摊位费: record.actualBoothFee,
      实际押金: record.actualDepositAmount,
      费用扣减: record.deductions.reduce((sum, d) => sum + d.amount, 0),
      总金额: record.totalAmount,
      状态: this.getStatusText(record.status),
      复核人: record.reviewedBy || '',
      复核时间: record.reviewedAt || '',
      差异数量: record.discrepancies.length,
      需要人工复核: record.discrepancies.some(d => d.requiresManualReview) ? '是' : '否'
    };

    const parser = new Parser();
    const csv = parser.parse([data]);

    const fileName = `对账单_${record.applicationNo}_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(this.reportsDir, fileName);
    fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');

    return filePath;
  }

  generateDetailedCSV(records: ReconciliationRecord[]): string {
    const data = records.map(record => ({
      申请编号: record.applicationNo,
      商户名称: record.merchantName,
      摊位位置: record.boothLocation,
      开始日期: record.startDate,
      结束日期: record.endDate,
      申请摊位费: record.boothFee,
      申请押金: record.depositAmount,
      实际摊位费: record.actualBoothFee,
      实际押金: record.actualDepositAmount,
      费用扣减: record.deductions.reduce((sum, d) => sum + d.amount, 0),
      总金额: record.totalAmount,
      状态: this.getStatusText(record.status),
      复核人: record.reviewedBy || '',
      差异数量: record.discrepancies.length,
      证照过期问题: record.discrepancies.filter(d => d.type === 'LICENSE_EXPIRED').length,
      时间冲突问题: record.discrepancies.filter(d => d.type === 'TIME_CONFLICT').length,
      缺失证照问题: record.discrepancies.filter(d => d.type === 'MISSING_DOCUMENT').length,
      费用不匹配问题: record.discrepancies.filter(d => d.type === 'FEE_MISMATCH').length
    }));

    const parser = new Parser();
    const csv = parser.parse(data);

    const fileName = `对账单汇总_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(this.reportsDir, fileName);
    fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');

    return filePath;
  }

  generateReconciliationPDF(record: ReconciliationRecord): string {
    const fileName = `对账单_${record.applicationNo}_${dayjs().format('YYYYMMDDHHmmss')}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('快闪摊位对账单', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    doc.moveDown();

    doc.fontSize(14).text('一、基本信息', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`申请编号: ${record.applicationNo}`);
    doc.text(`商户名称: ${record.merchantName}`);
    doc.text(`摊位位置: ${record.boothLocation}`);
    doc.text(`活动周期: ${record.startDate} 至 ${record.endDate}`);
    doc.text(`当前状态: ${this.getStatusText(record.status)}`);
    if (record.reviewedBy) {
      doc.text(`复核人: ${record.reviewedBy}`);
    }
    doc.moveDown();

    doc.fontSize(14).text('二、费用明细', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`申请摊位费: ¥${record.boothFee.toFixed(2)}`);
    doc.text(`申请押金金额: ¥${record.depositAmount.toFixed(2)}`);
    
    if (record.deductions.length > 0) {
      doc.moveDown();
      doc.text('费用扣减明细:');
      for (const deduction of record.deductions) {
        doc.text(`  - ${deduction.type}: ¥${deduction.amount.toFixed(2)}`);
        doc.text(`    原因: ${deduction.reason}`);
      }
    }
    
    const totalDeductions = record.deductions.reduce((sum, d) => sum + d.amount, 0);
    doc.moveDown();
    doc.text(`实际摊位费: ¥${record.actualBoothFee.toFixed(2)}`);
    doc.text(`实际押金金额: ¥${record.actualDepositAmount.toFixed(2)}`);
    doc.text(`费用扣减合计: ¥${totalDeductions.toFixed(2)}`);
    doc.fontSize(14).text(`应缴总金额: ¥${record.totalAmount.toFixed(2)}`);
    doc.moveDown();

    if (record.discrepancies.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('三、差异说明', { underline: true });
      doc.moveDown();
      
      for (let i = 0; i < record.discrepancies.length; i++) {
        const disc = record.discrepancies[i];
        doc.fontSize(12);
        doc.text(`${i + 1}. ${disc.description}`);
        doc.text(`   类型: ${this.getDiscrepancyTypeText(disc.type)}`);
        doc.text(`   严重程度: ${this.getSeverityText(disc.severity)}`);
        doc.text(`   状态: ${this.getDiscrepancyStatusText(disc.status)}`);
        if (disc.expectedValue && disc.actualValue) {
          doc.text(`   期望值: ${disc.expectedValue}`);
          doc.text(`   实际值: ${disc.actualValue}`);
        }
        if (disc.explanation) {
          doc.text(`   说明: ${disc.explanation}`);
        }
        doc.moveDown();
      }
    }

    if (record.reviewActions.length > 0) {
      doc.addPage();
      doc.fontSize(14).text('四、复核记录', { underline: true });
      doc.moveDown();
      
      for (let i = 0; i < record.reviewActions.length; i++) {
        const action = record.reviewActions[i];
        doc.fontSize(12);
        doc.text(`${i + 1}. 复核人: ${action.reviewer}`);
        doc.text(`   复核结果: ${this.getReviewResultText(action.reviewResult)}`);
        doc.text(`   复核意见: ${action.reviewNotes}`);
        if (action.adjustmentAmount !== undefined) {
          doc.text(`   调整金额: ¥${action.adjustmentAmount.toFixed(2)}`);
        }
        if (action.adjustmentReason) {
          doc.text(`   调整原因: ${action.adjustmentReason}`);
        }
        doc.text(`   复核时间: ${dayjs(action.reviewedAt).format('YYYY-MM-DD HH:mm:ss')}`);
        doc.moveDown();
      }
    }

    doc.end();

    return new Promise<string>((resolve) => {
      stream.on('finish', () => {
        resolve(filePath);
      });
    }) as any;
  }

  generateSummaryPDF(summary: ReconciliationSummary): string {
    const fileName = `对账汇总_${dayjs().format('YYYYMMDDHHmmss')}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text('快闪摊位对账汇总报告', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}`);
    doc.moveDown();

    doc.fontSize(14).text('一、对账统计', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`对账记录总数: ${summary.totalRecords}`);
    doc.text(`已批准记录: ${summary.approvedRecords}`);
    doc.text(`已拒绝记录: ${summary.rejectedRecords}`);
    doc.text(`待处理记录: ${summary.pendingRecords}`);
    doc.moveDown();

    doc.fontSize(14).text('二、费用汇总', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`摊位费合计: ¥${summary.totalBoothFee.toFixed(2)}`);
    doc.text(`押金合计: ¥${summary.totalDeposit.toFixed(2)}`);
    doc.text(`费用扣减合计: ¥${summary.totalDeductions.toFixed(2)}`);
    doc.fontSize(14).text(`应收总金额: ¥${summary.netAmount.toFixed(2)}`);
    doc.moveDown();

    doc.fontSize(14).text('三、问题统计', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`证照过期问题: ${summary.discrepancyCount.licenseExpired}`);
    doc.text(`时间冲突问题: ${summary.discrepancyCount.timeConflict}`);
    doc.text(`押金扣减问题: ${summary.discrepancyCount.depositDeduction}`);
    doc.text(`缺失证照问题: ${summary.discrepancyCount.missingDocument}`);
    doc.text(`费用不匹配问题: ${summary.discrepancyCount.feeMismatch}`);
    doc.text(`人工复核问题: ${summary.discrepancyCount.manualReview}`);

    doc.end();

    return new Promise<string>((resolve) => {
      stream.on('finish', () => {
        resolve(filePath);
      });
    }) as any;
  }

  getReportFilePath(fileName: string): string | null {
    const filePath = path.join(this.reportsDir, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
    return null;
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      DRAFT: '草稿',
      REVIEWING: '待复核',
      APPROVED: '已批准',
      REJECTED: '已拒绝',
      COMPLETED: '已完成'
    };
    return statusMap[status] || status;
  }

  private getDiscrepancyTypeText(type: string): string {
    const typeMap: Record<string, string> = {
      LICENSE_EXPIRED: '证照过期',
      TIME_CONFLICT: '时间冲突',
      DEPOSIT_DEDUCTION: '押金扣减',
      MISSING_DOCUMENT: '缺失证照',
      FEE_MISMATCH: '费用不匹配',
      MANUAL_REVIEW: '人工复核'
    };
    return typeMap[type] || type;
  }

  private getSeverityText(severity: string): string {
    const severityMap: Record<string, string> = {
      HIGH: '高',
      MEDIUM: '中',
      LOW: '低'
    };
    return severityMap[severity] || severity;
  }

  private getDiscrepancyStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      PENDING: '待处理',
      APPROVED: '已批准',
      REJECTED: '已拒绝',
      DOCUMENTS_REQUESTED: '已要求补材料'
    };
    return statusMap[status] || status;
  }

  private getReviewResultText(result: string): string {
    const resultMap: Record<string, string> = {
      APPROVE: '批准',
      REJECT: '拒绝',
      REQUEST_DOCUMENTS: '要求补材料',
      ADJUST_AND_APPROVE: '调整并批准'
    };
    return resultMap[result] || result;
  }
}

export const reportService = new ReportService();
