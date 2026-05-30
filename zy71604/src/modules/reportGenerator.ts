import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Decimal } from 'decimal.js';
import * as XLSX from 'xlsx';
import {
  ReportData,
  CalculationResult,
  ProcessingTask,
  Fund,
  DividendAnnouncement,
  ClientAccount,
  ReconciliationIssue,
  ReconciliationStatus,
} from '../types/models';
import { formatDecimal } from '../utils/numberUtils';

export type ReportFormat = 'json' | 'xlsx' | 'csv';
export type ReportType = 'summary' | 'detail' | 'issues' | 'full';

export interface ReportOptions {
  includeProcessed?: boolean;
  includePending?: boolean;
  includeRejected?: boolean;
  includeIssues?: boolean;
  format?: ReportFormat;
  precision?: number;
}

const defaultOptions: ReportOptions = {
  includeProcessed: true,
  includePending: true,
  includeRejected: true,
  includeIssues: true,
  format: 'xlsx',
  precision: 4,
};

interface ReportRow {
  accountNo: string;
  clientName: string;
  sharesOnRecordDate: string;
  dividendType: string;
  dividendPerUnit: string;
  totalDividendAmount: string;
  reinvestmentNav: string;
  theoreticalReinvestedShares: string;
  actualReinvestedShares: string;
  difference: string;
  status: string;
  issues: string;
  registrationDate: string;
}

interface IssueRow {
  type: string;
  severity: string;
  message: string;
  expectedValue?: string;
  actualValue?: string;
  affectedAccounts: number;
  resolved: string;
}

export class ReportGenerator {
  private precision: number;

  constructor(precision: number = 4) {
    this.precision = precision;
  }

  public generateReport(
    task: ProcessingTask,
    fund: Fund,
    announcement: DividendAnnouncement,
    results: CalculationResult[],
    accounts: ClientAccount[],
    options?: ReportOptions
  ): ReportData {
    const opts = { ...defaultOptions, ...options };

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    const processedItems = results.filter(
      r => r.status === 'matched'
    );
    const pendingItems = results.filter(
      r => r.status === 'pending'
    );
    const rejectedItems = results.filter(
      r => r.status === 'mismatch'
    );

    const allIssues = results.flatMap(r => r.issues).filter(i => !i.resolved);

    const totalReinvestedShares = results.reduce(
      (sum, r) => sum.add(r.theoreticalReinvestedShares),
      new Decimal(0)
    );
    const totalDividendAmount = results.reduce(
      (sum, r) => sum.add(r.totalDividendAmount),
      new Decimal(0)
    );

    return {
      taskId: task.id,
      generatedAt: dayjs().toISOString(),
      summary: {
        fundName: fund.fundName,
        fundCode: fund.fundCode,
        announcementId: announcement.announcementId,
        registrationDate: announcement.registrationDate,
        exDividendDate: announcement.exDividendDate,
        paymentDate: announcement.paymentDate,
        dividendPerUnit: announcement.dividendPerUnit,
        reinvestmentNav: announcement.reinvestmentNav,
        totalAccounts: results.length,
        processedCount: processedItems.length,
        confirmedCount: processedItems.length,
        pendingCount: pendingItems.length,
        rejectedCount: rejectedItems.length,
        totalReinvestedShares,
        totalDividendAmount,
      },
      processedItems: opts.includeProcessed ? processedItems : [],
      pendingItems: opts.includePending ? pendingItems : [],
      rejectedItems: opts.includeRejected ? rejectedItems : [],
      issues: opts.includeIssues ? allIssues : [],
    };
  }

  public exportToJSON(report: ReportData): string {
    return JSON.stringify(report, null, 2);
  }

  public exportToCSV(report: ReportData, accounts: ClientAccount[]): string {
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const allItems = [
      ...report.processedItems.map(r => ({ ...r, reportStatus: '已处理' })),
      ...report.pendingItems.map(r => ({ ...r, reportStatus: '待确认' })),
      ...report.rejectedItems.map(r => ({ ...r, reportStatus: '退回补材料' })),
    ];

    const headers = [
      '状态',
      '账号',
      '客户名称',
      '权益登记日',
      '登记日份额',
      '分红方式',
      '每份分红',
      '分红总额',
      '再投资净值',
      '理论再投资份额',
      '实际到账份额',
      '差异',
      '问题说明',
    ];

    const rows = allItems.map(item => {
      const account = accountMap.get(item.accountId);
      const difference = item.actualReinvestedShares
        ? item.actualReinvestedShares.sub(item.theoreticalReinvestedShares)
        : new Decimal(0);

      return [
        (item as any).reportStatus,
        account?.accountNo || item.accountId,
        account?.clientName || '',
        item.registrationDate,
        formatDecimal(item.sharesOnRecordDate, this.precision),
        item.dividendType === 'reinvestment' ? '红利再投资' : '现金分红',
        formatDecimal(item.dividendPerUnit, 4),
        formatDecimal(item.totalDividendAmount, 2),
        formatDecimal(item.reinvestmentNav, 4),
        formatDecimal(item.theoreticalReinvestedShares, this.precision),
        item.actualReinvestedShares
          ? formatDecimal(item.actualReinvestedShares, this.precision)
          : '',
        formatDecimal(difference, this.precision),
        item.issues.map(i => i.message).join('; '),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  public exportToExcel(
    report: ReportData,
    accounts: ClientAccount[],
    filePath: string
  ): void {
    const accountMap = new Map(accounts.map(a => [a.id, a]));
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['基金名称', report.summary.fundName],
      ['基金代码', report.summary.fundCode],
      ['公告编号', report.summary.announcementId],
      ['权益登记日', report.summary.registrationDate],
      ['除息日', report.summary.exDividendDate],
      ['红利发放日', report.summary.paymentDate],
      ['每份分红', formatDecimal(report.summary.dividendPerUnit, 4)],
      ['再投资净值', formatDecimal(report.summary.reinvestmentNav, 4)],
      ['', ''],
      ['总户数', report.summary.totalAccounts],
      ['已处理', report.summary.processedCount],
      ['待确认', report.summary.pendingCount],
      ['退回补材料', report.summary.rejectedCount],
      ['', ''],
      ['再投资总份额', formatDecimal(report.summary.totalReinvestedShares, this.precision)],
      ['分红总金额', formatDecimal(report.summary.totalDividendAmount, 2)],
      ['报告生成时间', report.generatedAt],
    ];

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, '汇总');

    if (report.processedItems.length > 0) {
      const processedWs = this.createResultSheet(
        report.processedItems,
        accountMap,
        '已处理'
      );
      XLSX.utils.book_append_sheet(wb, processedWs, '已处理');
    }

    if (report.pendingItems.length > 0) {
      const pendingWs = this.createResultSheet(
        report.pendingItems,
        accountMap,
        '待确认'
      );
      XLSX.utils.book_append_sheet(wb, pendingWs, '待确认');
    }

    if (report.rejectedItems.length > 0) {
      const rejectedWs = this.createResultSheet(
        report.rejectedItems,
        accountMap,
        '退回补材料'
      );
      XLSX.utils.book_append_sheet(wb, rejectedWs, '退回补材料');
    }

    if (report.issues.length > 0) {
      const issuesWs = this.createIssuesSheet(report.issues);
      XLSX.utils.book_append_sheet(wb, issuesWs, '问题清单');
    }

    XLSX.writeFile(wb, filePath);
  }

  private createResultSheet(
    items: CalculationResult[],
    accountMap: Map<string, ClientAccount>,
    status: string
  ): XLSX.WorkSheet {
    const headers = [
      '账号',
      '客户名称',
      '权益登记日',
      '登记日份额',
      '分红方式',
      '每份分红',
      '分红总额',
      '再投资净值',
      '理论再投资份额',
      '实际到账份额',
      '差异',
      '问题说明',
    ];

    const data = items.map(item => {
      const account = accountMap.get(item.accountId);
      const difference = item.actualReinvestedShares
        ? item.actualReinvestedShares.sub(item.theoreticalReinvestedShares)
        : new Decimal(0);

      return {
        '账号': account?.accountNo || item.accountId,
        '客户名称': account?.clientName || '',
        '权益登记日': item.registrationDate,
        '登记日份额': formatDecimal(item.sharesOnRecordDate, this.precision),
        '分红方式': item.dividendType === 'reinvestment' ? '红利再投资' : '现金分红',
        '每份分红': formatDecimal(item.dividendPerUnit, 4),
        '分红总额': formatDecimal(item.totalDividendAmount, 2),
        '再投资净值': formatDecimal(item.reinvestmentNav, 4),
        '理论再投资份额': formatDecimal(item.theoreticalReinvestedShares, this.precision),
        '实际到账份额': item.actualReinvestedShares
          ? formatDecimal(item.actualReinvestedShares, this.precision)
          : '',
        '差异': formatDecimal(difference, this.precision),
        '问题说明': item.issues.map(i => i.message).join('; '),
      };
    });

    return XLSX.utils.json_to_sheet(data, { header: headers });
  }

  private createIssuesSheet(issues: ReconciliationIssue[]): XLSX.WorkSheet {
    const typeNames: Record<string, string> = {
      date_mismatch: '日期不一致',
      share_rounding: '份额舍入差异',
      cash_to_reinvest: '现金分红误转投',
      nav_mismatch: '净值不一致',
      choice_mismatch: '分红方式选择异常',
      other: '其他问题',
    };

    const severityNames: Record<string, string> = {
      warning: '警告',
      error: '错误',
      critical: '严重',
    };

    const headers = [
      '问题类型',
      '严重程度',
      '问题描述',
      '期望值',
      '实际值',
      '是否已解决',
      '解决方案',
    ];

    const data = issues.map(issue => ({
      '问题类型': typeNames[issue.type] || issue.type,
      '严重程度': severityNames[issue.severity] || issue.severity,
      '问题描述': issue.message,
      '期望值': issue.expectedValue || '',
      '实际值': issue.actualValue || '',
      '是否已解决': issue.resolved ? '是' : '否',
      '解决方案': issue.resolution || '',
    }));

    return XLSX.utils.json_to_sheet(data, { header: headers });
  }

  public generateStatistics(report: ReportData): {
    byStatus: Record<string, number>;
    byIssueType: Record<string, number>;
    bySeverity: Record<string, number>;
    totalAmount: string;
    totalShares: string;
  } {
    const byStatus: Record<string, number> = {
      processed: report.processedItems.length,
      pending: report.pendingItems.length,
      rejected: report.rejectedItems.length,
    };

    const byIssueType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const issue of report.issues) {
      byIssueType[issue.type] = (byIssueType[issue.type] || 0) + 1;
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
    }

    return {
      byStatus,
      byIssueType,
      bySeverity,
      totalAmount: formatDecimal(report.summary.totalDividendAmount, 2),
      totalShares: formatDecimal(report.summary.totalReinvestedShares, this.precision),
    };
  }

  public getStatusSummary(report: ReportData): string {
    const stats = this.generateStatistics(report);
    const lines = [
      `【${report.summary.fundName}(${report.summary.fundCode})】分红再投资核算报告`,
      `公告编号: ${report.summary.announcementId}`,
      `权益登记日: ${report.summary.registrationDate}`,
      '',
      `处理统计:`,
      `  - 总户数: ${report.summary.totalAccounts}`,
      `  - 已处理: ${stats.byStatus.processed}`,
      `  - 待确认: ${stats.byStatus.pending}`,
      `  - 退回补材料: ${stats.byStatus.rejected}`,
      '',
      `金额统计:`,
      `  - 分红总金额: ${stats.totalAmount} 元`,
      `  - 再投资总份额: ${stats.totalShares} 份`,
      '',
      `问题统计:`,
    ];

    const severityNames: Record<string, string> = {
      warning: '警告',
      error: '错误',
      critical: '严重',
    };

    for (const [severity, count] of Object.entries(stats.bySeverity)) {
      lines.push(`  - ${severityNames[severity] || severity}: ${count}`);
    }

    lines.push('', `报告生成时间: ${report.generatedAt}`);

    return lines.join('\n');
  }
}
