import { v4 as uuidv4 } from 'uuid';
import {
  MigrationReport,
  MigrationReportFilter,
  AccountFreezeRecord,
  FreezeStatus,
  FreezeReason
} from '../types';
import { recordStore } from '../store/RecordStore';
import { getStatusDisplayName, getReasonDisplayName } from '../stateMachine/transitions';
import { getSourceDisplayName } from '../stateMachine/parameterValidator';

export class MigrationReportGenerator {
  private lastFilter: MigrationReportFilter | null = null;
  private lastReport: MigrationReport | null = null;

  generateReport(filter: MigrationReportFilter): MigrationReport {
    this.lastFilter = { ...filter };

    const records = recordStore.filterRecords(filter);
    const summary = this.generateSummary(records);

    const report: MigrationReport = {
      reportId: uuidv4(),
      generatedAt: new Date(),
      filter: this.lastFilter,
      totalRecords: records.length,
      summary,
      records
    };

    this.lastReport = report;
    return report;
  }

  regenerateLastReport(): MigrationReport | null {
    if (!this.lastFilter) return null;
    return this.generateReport(this.lastFilter);
  }

  getLastReport(): MigrationReport | null {
    return this.lastReport;
  }

  getLastFilter(): MigrationReportFilter | null {
    return this.lastFilter ? { ...this.lastFilter } : null;
  }

  exportToCSV(filter: MigrationReportFilter): string {
    const report = this.generateReport(filter);
    return this.convertToCSV(report);
  }

  exportToJSON(filter: MigrationReportFilter): string {
    const report = this.generateReport(filter);
    return JSON.stringify(report, null, 2);
  }

  private generateSummary(records: AccountFreezeRecord[]) {
    const byStatus: Record<FreezeStatus, number> = {} as Record<FreezeStatus, number>;
    const byReason: Record<FreezeReason, number> = {} as Record<FreezeReason, number>;

    Object.values(FreezeStatus).forEach(status => {
      byStatus[status as FreezeStatus] = 0;
    });

    Object.values(FreezeReason).forEach(reason => {
      byReason[reason as FreezeReason] = 0;
    });

    let autoApproved = 0;
    let manualReviewRequired = 0;
    let historicalRecords = 0;
    let parameterIssues = 0;

    records.forEach(record => {
      byStatus[record.status]++;
      byReason[record.freezeReason]++;

      if (record.status === FreezeStatus.AUTO_FREEZE_APPROVED || record.status === FreezeStatus.FROZEN) {
        autoApproved++;
      }

      if (record.status === FreezeStatus.MANUAL_REVIEW_REQUIRED) {
        manualReviewRequired++;
      }

      if (record.isHistorical) {
        historicalRecords++;
      }

      if (record.parameterValidationIssues && record.parameterValidationIssues.length > 0) {
        parameterIssues++;
      }
    });

    return {
      byStatus,
      byReason,
      autoApproved,
      manualReviewRequired,
      historicalRecords,
      parameterIssues
    };
  }

  private convertToCSV(report: MigrationReport): string {
    const headers = [
      '记录ID',
      '请求ID',
      '账户ID',
      '账户名称',
      '冻结原因',
      '当前状态',
      '风险评分',
      '判断理由',
      '下一步操作',
      '负责人',
      '参数来源',
      '参数问题数',
      '是否历史记录',
      '创建时间',
      '更新时间'
    ];

    const rows = report.records.map(record => [
      record.recordId,
      record.requestId,
      record.accountId,
      record.accountName,
      getReasonDisplayName(record.freezeReason),
      getStatusDisplayName(record.status),
      record.riskScore ?? 'N/A',
      record.decisionReason ?? 'N/A',
      record.nextStep ?? 'N/A',
      record.nextStepOwner ?? 'N/A',
      record.parameterSource ? getSourceDisplayName(record.parameterSource) : 'N/A',
      record.parameterValidationIssues?.length ?? 0,
      record.isHistorical ? '是' : '否',
      record.createdAt.toISOString(),
      record.updatedAt.toISOString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return `\uFEFF${csvContent}`;
  }

  generateSummaryText(report: MigrationReport): string {
    const lines = [];
    lines.push('=' .repeat(60));
    lines.push('账户冻结迁移报告摘要');
    lines.push('=' .repeat(60));
    lines.push(`报告ID: ${report.reportId}`);
    lines.push(`生成时间: ${report.generatedAt.toLocaleString('zh-CN')}`);
    lines.push(`记录总数: ${report.totalRecords}`);
    lines.push('');
    lines.push('--- 按状态统计 ---');
    Object.entries(report.summary.byStatus).forEach(([status, count]) => {
      if (count > 0) {
        lines.push(`  ${getStatusDisplayName(status as FreezeStatus)}: ${count}条`);
      }
    });
    lines.push('');
    lines.push('--- 按原因统计 ---');
    Object.entries(report.summary.byReason).forEach(([reason, count]) => {
      if (count > 0) {
        lines.push(`  ${getReasonDisplayName(reason as FreezeReason)}: ${count}条`);
      }
    });
    lines.push('');
    lines.push('--- 关键指标 ---');
    lines.push(`  自动审批通过: ${report.summary.autoApproved}条`);
    lines.push(`  需人工审核: ${report.summary.manualReviewRequired}条`);
    lines.push(`  历史重复记录: ${report.summary.historicalRecords}条`);
    lines.push(`  存在参数问题: ${report.summary.parameterIssues}条`);
    lines.push('=' .repeat(60));

    return lines.join('\n');
  }
}

export const reportGenerator = new MigrationReportGenerator();
