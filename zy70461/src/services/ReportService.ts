import { ProcessReportDAO } from '../models/ProcessReportDAO';
import { SubmissionDAO } from '../models/SubmissionDAO';
import { SubmissionService } from './SubmissionService';
import { ProcessReport, ProcessStats } from '../models/types';

export class ReportService {
  static async generateBatchReport(
    batchId: string,
    processedBy: string
  ): Promise<ProcessReport> {
    const beforeStats = SubmissionDAO.getStats(batchId);
    const startTime = Date.now();

    const processedCount = await SubmissionService.processBatch(batchId, processedBy);
    const executionTime = Date.now() - startTime;

    const afterStats = SubmissionDAO.getStats(batchId);
    const nextSuggestions = this.generateNextSuggestions(beforeStats, afterStats);

    const submissions = SubmissionDAO.getByBatchId(batchId);
    const ruleVersionUsed = submissions.length > 0 ? submissions[0].ruleVersionId : 'unknown';

    const report = ProcessReportDAO.create({
      batchId,
      beforeStats,
      afterStats,
      executionTime,
      processedCount,
      nextSuggestions,
      ruleVersionUsed
    });

    return report;
  }

  static getReportById(id: string): ProcessReport | null {
    return ProcessReportDAO.getById(id);
  }

  static getReportsByBatchId(batchId: string): ProcessReport[] {
    return ProcessReportDAO.getByBatchId(batchId);
  }

  static getAllReports(): ProcessReport[] {
    return ProcessReportDAO.getAll();
  }

  static formatReport(report: ProcessReport): string {
    const lines: string[] = [];
    lines.push('='.repeat(60));
    lines.push(`批次处理报告 - ${report.batchId}`);
    lines.push(`生成时间: ${report.generatedAt.toLocaleString()}`);
    lines.push(`规则版本: ${report.ruleVersionUsed}`);
    lines.push('='.repeat(60));
    lines.push('');

    lines.push('【处理前后对比】');
    lines.push('');
    lines.push('处理前:');
    lines.push(`  总计: ${report.beforeStats.total}`);
    lines.push(`  待处理: ${report.beforeStats.pending}`);
    lines.push(`  已通过: ${report.beforeStats.approved}`);
    lines.push(`  已拒绝: ${report.beforeStats.rejected}`);
    lines.push(`  附件过期: ${report.beforeStats.attachmentExpired}`);
    lines.push('');
    lines.push('处理后:');
    lines.push(`  总计: ${report.afterStats.total}`);
    lines.push(`  待处理: ${report.afterStats.pending}`);
    lines.push(`  已通过: ${report.afterStats.approved}`);
    lines.push(`  已拒绝: ${report.afterStats.rejected}`);
    lines.push(`  附件过期: ${report.afterStats.attachmentExpired}`);
    lines.push('');

    lines.push('【执行统计】');
    lines.push(`处理数量: ${report.processedCount} 份`);
    lines.push(`执行时间: ${report.executionTime} 毫秒`);
    if (report.processedCount > 0) {
      lines.push(`平均耗时: ${(report.executionTime / report.processedCount).toFixed(2)} 毫秒/份`);
    }
    lines.push('');

    lines.push('【变更明细】');
    const approvedChange = report.afterStats.approved - report.beforeStats.approved;
    const rejectedChange = report.afterStats.rejected - report.beforeStats.rejected;
    const expiredChange = report.afterStats.attachmentExpired - report.beforeStats.attachmentExpired;
    if (approvedChange !== 0) lines.push(`  通过数变更: ${approvedChange > 0 ? '+' : ''}${approvedChange}`);
    if (rejectedChange !== 0) lines.push(`  拒绝数变更: ${rejectedChange > 0 ? '+' : ''}${rejectedChange}`);
    if (expiredChange !== 0) lines.push(`  过期附件变更: ${expiredChange > 0 ? '+' : ''}${expiredChange}`);
    lines.push('');

    lines.push('【下一步建议】');
    report.nextSuggestions.forEach((suggestion, idx) => {
      lines.push(`  ${idx + 1}. ${suggestion}`);
    });
    lines.push('');
    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  private static generateNextSuggestions(before: ProcessStats, after: ProcessStats): string[] {
    const suggestions: string[] = [];

    if (after.attachmentExpired > 0) {
      suggestions.push(`共有 ${after.attachmentExpired} 份提交附件已过期，请通知学生重新上传`);
    }

    if (after.rejected > before.rejected) {
      suggestions.push('部分提交被拒绝，请检查具体原因并反馈给相关学生');
    }

    if (after.pending > 0) {
      suggestions.push(`仍有 ${after.pending} 份提交待处理，建议及时审核`);
    }

    if (after.approved === after.total && after.pending === 0 && after.rejected === 0 && after.attachmentExpired === 0) {
      suggestions.push('全部提交已通过审核，可以进行下一步汇总统计');
    }

    if (suggestions.length === 0) {
      suggestions.push('处理完成，建议定期检查系统状态以确保数据一致性');
    }

    return suggestions;
  }
}
