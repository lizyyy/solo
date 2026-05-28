import { VoucherRepository } from '../repositories/VoucherRepository';
import { ReportRepository } from '../repositories/ReportRepository';
import { BalanceService } from './BalanceService';
import type { CollationReport } from '../../shared/types';
import fs from 'fs';
import path from 'path';

export class ReportService {
  static generateReport(period: string, generatedBy: string): CollationReport {
    const vouchers = VoucherRepository.findAll();
    const periodVouchers = vouchers.filter(v => v.date.startsWith(period));

    BalanceService.calculateBalances(period);
    const warnings = BalanceService.verifyBalances(period);

    const items = periodVouchers.map(v => {
      const mapping = v.mappings.find(m => m.direction === (v.description?.includes('收入') ? 'credit' : 'debit'));
      const hasException = v.status === 'exception' || v.revisions.length > 0 || v.images.some(img => img.clarity < 70);
      const exceptionReasons: string[] = [];

      if (v.images.some(img => img.clarity < 70)) {
        exceptionReasons.push('票据清晰度不足');
      }
      if (v.revisions.length > 0) {
        exceptionReasons.push(`经过${v.revisions.length}次人工修订`);
      }
      if (v.parseResult && v.parseResult.confidence < 70) {
        exceptionReasons.push('OCR识别置信度低');
      }

      return {
        voucherId: v.id,
        voucherNo: v.voucherNo,
        date: v.date,
        description: v.description,
        amount: v.amount,
        subjectName: mapping?.subjectName || '未映射',
        hasException,
        exceptionReason: exceptionReasons.join('；') || null,
      };
    });

    const exceptionCount = items.filter(i => i.hasException).length;
    const revisionCount = periodVouchers.reduce((sum, v) => sum + v.revisions.length, 0);
    const completedCount = periodVouchers.filter(v => v.status === 'completed').length;
    const reviewingCount = periodVouchers.filter(v => v.status === 'reviewing').length;

    return ReportRepository.create({
      period,
      voucherCount: periodVouchers.length,
      totalVouchers: periodVouchers.length,
      completedVouchers: completedCount,
      reviewingVouchers: reviewingCount,
      exceptionVouchers: exceptionCount,
      totalAmount: periodVouchers.reduce((sum, v) => sum + v.amount, 0),
      exceptionCount,
      revisionCount,
      generatedBy,
      items: items.map(item => {
        const voucher = periodVouchers.find(v => v.id === item.voucherId);
        return {
          ...item,
          customerName: voucher?.customerName || '',
          status: voucher?.status || 'pending',
        };
      }),
    });
  }

  static exportReport(reportId: string, format: 'xlsx' | 'csv', exportedBy: string): { fileName: string; filePath: string } {
    const report = ReportRepository.findById(reportId);
    if (!report) throw new Error('报告不存在');

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `现金凭证整理报告_${report.period}_${Date.now()}.${format}`;
    const filePath = path.join(exportDir, fileName);

    if (format === 'csv') {
      let csvContent = '\uFEFF';
      csvContent += '现金凭证整理报告\n';
      csvContent += `期间,${report.period}\n`;
      csvContent += `凭证数量,${report.voucherCount}\n`;
      csvContent += `总金额,${report.totalAmount.toFixed(2)}\n`;
      csvContent += `异常凭证数,${report.exceptionCount}\n`;
      csvContent += `修订次数,${report.revisionCount}\n`;
      csvContent += `生成时间,${report.createdAt}\n`;
      csvContent += `生成人,${report.generatedBy}\n\n`;
      csvContent += '凭证号,日期,摘要,金额,科目,是否异常,异常原因,数据来源追溯\n';

      for (const item of report.items) {
        csvContent += `${item.voucherNo},${item.date},"${item.description || ''}",${item.amount.toFixed(2)},${item.subjectName},${item.hasException ? '是' : '否'},"${item.exceptionReason || ''}","voucher_id:${item.voucherId}"\n`;
      }

      fs.writeFileSync(filePath, csvContent, 'utf-8');
    } else {
      let xlsxContent = 'EXPORTDATA:';
      xlsxContent += JSON.stringify({
        report,
        exportInfo: {
          exportedBy,
          exportedAt: new Date().toISOString(),
          trace: report.items.map(i => ({ voucherId: i.voucherId, voucherNo: i.voucherNo })),
        },
      });
      fs.writeFileSync(filePath, xlsxContent, 'utf-8');
    }

    ReportRepository.logExport({
      reportId,
      exportType: format,
      fileName,
      filePath,
      exportedBy,
    });

    return { fileName, filePath };
  }

  static getExportHistory(reportId?: string) {
    return ReportRepository.getExportLogs(reportId);
  }

  static traceVoucherFromExport(exportId: string) {
    const logs = ReportRepository.getExportLogs();
    const log = (logs as any[]).find(l => l.id === exportId);
    if (!log) return null;

    if (log.reportId) {
      const report = ReportRepository.findById(log.reportId);
      if (report) {
        return {
          exportLog: log,
          report,
          vouchers: report.items.map(item => {
            const voucher = VoucherRepository.findById(item.voucherId);
            return {
              reportItem: item,
              voucher,
            };
          }),
        };
      }
    }

    return { exportLog: log };
  }
}
