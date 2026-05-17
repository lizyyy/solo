import { Parser } from 'json2csv';
import { ExplanationReport, EvaluationStatus } from '../models/types';
import { evaluationService } from './evaluation.service';

type ExportFormat = 'csv' | 'json';

interface ExportOptions {
  format: ExportFormat;
  flagName?: string;
  tenantId?: string;
  userId?: string;
  status?: EvaluationStatus;
  startDate?: Date;
  endDate?: Date;
}

class ExportService {
  async exportReports(options: ExportOptions): Promise<{ data: string; contentType: string; filename: string }> {
    const { data: reports } = await evaluationService.queryReports({
      flagName: options.flagName,
      tenantId: options.tenantId,
      userId: options.userId,
      status: options.status,
      startDate: options.startDate,
      endDate: options.endDate,
      page: 1,
      pageSize: 10000
    });

    if (reports.length === 0) {
      throw new Error('没有符合条件的报告可导出');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `featureflag-explanations-${timestamp}`;

    if (options.format === 'csv') {
      return this.exportToCSV(reports, filename);
    } else {
      return this.exportToJSON(reports, filename);
    }
  }

  private exportToCSV(reports: ExplanationReport[], filename: string): { data: string; contentType: string; filename: string } {
    const fields = [
      { label: '报告ID', value: 'id' },
      { label: '开关名称', value: 'context.flagName' },
      { label: '租户ID', value: 'context.tenantId' },
      { label: '用户ID', value: 'context.userId' },
      { label: '邮箱', value: 'context.email' },
      { label: '环境', value: 'context.environment' },
      { label: '状态', value: 'status' },
      { label: '最终值', value: 'finalValue' },
      { label: '匹配规则数', value: (report: ExplanationReport) => report.matchedRules.length },
      { label: '匹配分组数', value: (report: ExplanationReport) => report.matchedGroups.length },
      { label: '覆盖链长度', value: (report: ExplanationReport) => report.overrideChain.length },
      { label: '错误信息', value: (report: ExplanationReport) => report.error?.message || '' },
      { label: '是否人工修正', value: (report: ExplanationReport) => report.manualCorrection ? '是' : '否' },
      { label: '创建时间', value: (report: ExplanationReport) => report.createdAt.toISOString() },
      { label: '更新时间', value: (report: ExplanationReport) => report.updatedAt.toISOString() }
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(reports);

    return {
      data: '\uFEFF' + csv,
      contentType: 'text/csv; charset=utf-8',
      filename: `${filename}.csv`
    };
  }

  private exportToJSON(reports: ExplanationReport[], filename: string): { data: string; contentType: string; filename: string } {
    const jsonData = reports.map(report => ({
      id: report.id,
      context: report.context,
      status: report.status,
      finalValue: report.finalValue,
      overrideChain: report.overrideChain.map(link => ({
        source: link.source,
        sourceName: link.sourceName,
        previousValue: link.previousValue,
        newValue: link.newValue,
        reason: link.reason,
        timestamp: link.timestamp.toISOString()
      })),
      matchedRules: report.matchedRules,
      matchedGroups: report.matchedGroups,
      hasError: !!report.error,
      errorMessage: report.error?.message,
      manualCorrection: report.manualCorrection ? {
        correctedBy: report.manualCorrection.correctedBy,
        correctionReason: report.manualCorrection.correctionReason,
        originalValue: report.manualCorrection.originalValue
      } : null,
      processingLog: report.processingLog,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString()
    }));

    return {
      data: JSON.stringify(jsonData, null, 2),
      contentType: 'application/json; charset=utf-8',
      filename: `${filename}.json`
    };
  }

  async exportSingleReport(reportId: string, format: ExportFormat): Promise<{ data: string; contentType: string; filename: string }> {
    const report = await evaluationService.getReport(reportId);
    if (!report) {
      throw new Error(`报告不存在: ${reportId}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `featureflag-explanation-${reportId}-${timestamp}`;

    if (format === 'csv') {
      const fields = [
        { label: '项目', value: 'key' },
        { label: '值', value: 'value' }
      ];

      const data = [
        { key: '报告ID', value: report.id },
        { key: '开关名称', value: report.context.flagName },
        { key: '租户ID', value: report.context.tenantId },
        { key: '用户ID', value: report.context.userId || '' },
        { key: '邮箱', value: report.context.email || '' },
        { key: '环境', value: report.context.environment },
        { key: '状态', value: report.status },
        { key: '最终值', value: report.finalValue.toString() },
        { key: '原始输入', value: report.rawInput },
        { key: '创建时间', value: report.createdAt.toISOString() },
        { key: '', value: '' },
        { key: '覆盖链详情', value: '' },
        ...report.overrideChain.map((link, index) => ({
          key: `覆盖 ${index + 1}: ${link.sourceName}`,
          value: `${link.previousValue} -> ${link.newValue} (原因: ${link.reason})`
        })),
        { key: '', value: '' },
        { key: '处理日志', value: '' },
        ...report.processingLog.map((log, index) => ({
          key: `日志 ${index + 1}`,
          value: log
        }))
      ];

      if (report.error) {
        data.push({ key: '', value: '' });
        data.push({ key: '错误信息', value: report.error.message });
        data.push({ key: '错误步骤', value: report.error.step });
      }

      if (report.manualCorrection) {
        data.push({ key: '', value: '' });
        data.push({ key: '人工修正操作人', value: report.manualCorrection.correctedBy });
        data.push({ key: '人工修正原因', value: report.manualCorrection.correctionReason });
        data.push({ key: '原始值', value: report.manualCorrection.originalValue.toString() });
      }

      const parser = new Parser({ fields });
      const csv = parser.parse(data);

      return {
        data: '\uFEFF' + csv,
        contentType: 'text/csv; charset=utf-8',
        filename: `${filename}.csv`
      };
    } else {
      const jsonData = {
        id: report.id,
        context: report.context,
        status: report.status,
        finalValue: report.finalValue,
        overrideChain: report.overrideChain.map(link => ({
          source: link.source,
          sourceName: link.sourceName,
          previousValue: link.previousValue,
          newValue: link.newValue,
          reason: link.reason,
          timestamp: link.timestamp.toISOString()
        })),
        matchedRules: report.matchedRules,
        matchedGroups: report.matchedGroups,
        rawInput: report.rawInput,
        processingLog: report.processingLog,
        error: report.error,
        manualCorrection: report.manualCorrection,
        createdAt: report.createdAt.toISOString(),
        updatedAt: report.updatedAt.toISOString()
      };

      return {
        data: JSON.stringify(jsonData, null, 2),
        contentType: 'application/json; charset=utf-8',
        filename: `${filename}.json`
      };
    }
  }
}

export const exportService = new ExportService();
