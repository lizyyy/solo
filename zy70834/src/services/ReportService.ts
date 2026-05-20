import * as fs from 'fs';
import { parse } from 'json2csv';
import {
  ReconciliationResult,
  SummaryStatistics,
  ExportReport,
  RecordStatus,
  DiscrepancyType,
} from '../types';
import { formatDate } from '../utils/date';

export class ReportService {
  generateSummary(results: ReconciliationResult[]): SummaryStatistics {
    const summary: SummaryStatistics = {
      totalStudents: results.length,
      totalChecked: results.filter((r) => r.healthCheck).length,
      pending: results.filter((r) => r.status === 'PENDING').length,
      approved: results.filter((r) => r.status === 'APPROVED').length,
      rejected: results.filter((r) => r.status === 'REJECTED').length,
      needsMoreInfo: results.filter((r) => r.status === 'NEEDS_MORE_INFO').length,
      feverCases: results.filter(
        (r) => r.discrepancies.some((d) => d.type === 'FEVER_DETECTED')
      ).length,
      overdueMedications: results.filter(
        (r) => r.discrepancies.some((d) => d.type === 'OVERDUE_MEDICATION')
      ).length,
      unconfirmedMedications: results.filter(
        (r) => r.discrepancies.some((d) => d.type === 'PARENT_NOT_CONFIRMED')
      ).length,
      discrepanciesByType: this.countDiscrepanciesByType(results),
    };
    return summary;
  }

  private countDiscrepanciesByType(
    results: ReconciliationResult[]
  ): Record<DiscrepancyType, number> {
    const counts: Record<DiscrepancyType, number> = {
      FEVER_DETECTED: 0,
      OVERDUE_MEDICATION: 0,
      PARENT_NOT_CONFIRMED: 0,
      STUDENT_NOT_IN_CLASS: 0,
      MEDICATION_NOT_RECORDED: 0,
      SYMPTOMS_UNCHECKED: 0,
      DATA_MISMATCH: 0,
    };

    for (const result of results) {
      for (const discrepancy of result.discrepancies) {
        counts[discrepancy.type]++;
      }
    }

    return counts;
  }

  generateExportReport(
    results: ReconciliationResult[],
    generatedBy: string
  ): ExportReport {
    return {
      summary: this.generateSummary(results),
      results: results,
      generatedAt: formatDate(new Date()),
      generatedBy,
    };
  }

  exportToJSON(report: ExportReport, filePath: string): void {
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }

  exportToCSV(results: ReconciliationResult[], filePath: string): void {
    const flattened = results.map((result) => ({
      对账日期: result.reconciliationDate,
      学号: result.studentId,
      姓名: result.studentName,
      班级: result.className,
      状态: this.translateStatus(result.status),
      晨检体温: result.healthCheck?.temperature || '无记录',
      是否隔离: result.healthCheck?.isIsolated ? '是' : '否',
      用药名称: result.medication?.medicationName || '无',
      家长确认: result.medication?.parentConfirmed ? '已确认' : '未确认',
      药品有效期: result.medication?.expiryDate || '无',
      差异数量: result.discrepancies.length,
      差异说明: result.discrepancies.map((d) => d.description).join('; '),
      审核人: result.reviewedBy || '未审核',
      审核时间: result.reviewedAt || '无',
      审核备注: result.reviewNotes || '无',
    }));

    const csv = parse(flattened);
    fs.writeFileSync(filePath, csv, 'utf-8');
  }

  generateTextReport(report: ExportReport): string {
    const { summary, results, generatedAt, generatedBy } = report;

    let text = `
═══════════════════════════════════════════════════════════════
              晨检对账日报表
═══════════════════════════════════════════════════════════════
生成时间: ${generatedAt}
生成人: ${generatedBy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                           汇总统计
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

学生总数: ${summary.totalStudents} 人
已完成晨检: ${summary.totalChecked} 人 (${(
      (summary.totalChecked / summary.totalStudents) *
      100
    ).toFixed(1)}%)

状态分布:
  ✅ 已通过: ${summary.approved} 人
  ⏳ 待处理: ${summary.pending} 人
  ❌ 已驳回: ${summary.rejected} 人
  📋 需补材料: ${summary.needsMoreInfo} 人

重点关注事项:
  🌡️ 发热病例: ${summary.feverCases} 人 (需立即隔离处理)
  ⚠️ 药品过期: ${summary.overdueMedications} 项
  ❓ 未获家长确认: ${summary.unconfirmedMedications} 项

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                          明细记录
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    const statusGroups: Record<RecordStatus, ReconciliationResult[]> = {
      REJECTED: [],
      NEEDS_MORE_INFO: [],
      PENDING: [],
      APPROVED: [],
    };

    for (const result of results) {
      statusGroups[result.status].push(result);
    }

    for (const [status, groupResults] of Object.entries(statusGroups)) {
      if (groupResults.length === 0) continue;

      text += `
┌─────────────────────────────────────────────────────────────┐
│ 【${this.translateStatus(status as RecordStatus)}】${
        groupResults.length
      }人
└─────────────────────────────────────────────────────────────┘
`;

      for (const result of groupResults) {
        text += this.formatResultDetail(result);
      }
    }

    text += `
═══════════════════════════════════════════════════════════════
                           报表结束
═══════════════════════════════════════════════════════════════
`;

    return text;
  }

  private formatResultDetail(result: ReconciliationResult): string {
    let detail = `
  ▶ ${result.studentName} (${result.studentId}) - ${result.className}
    ├─ 晨检: ${this.formatHealthCheck(result)}
    ├─ 用药: ${this.formatMedication(result)}
    └─ 结论: `;

    if (result.discrepancies.length > 0) {
      detail += `发现 ${result.discrepancies.length} 项问题\n`;
      for (const [index, discrepancy] of result.discrepancies.entries()) {
        const isLast = index === result.discrepancies.length - 1;
        const prefix = isLast ? '       └─' : '       ├─';
        detail += `${prefix} [${this.translateSeverity(discrepancy.severity)}] ${
          discrepancy.description
        }\n`;
        detail += `          ▶ 说明: ${discrepancy.explanation}\n`;
      }
    } else {
      detail += '正常\n';
    }

    if (result.reviewedBy) {
      detail += `
    ┌─ 审核记录 ────────────────────────────────────────────────
    │ 审核人: ${result.reviewedBy}
    │ 审核时间: ${result.reviewedAt}
    │ 审核意见: ${result.reviewNotes || '无'}
    └───────────────────────────────────────────────────────────
`;
    }

    return detail;
  }

  private formatHealthCheck(result: ReconciliationResult): string {
    if (!result.healthCheck) {
      return '无记录';
    }
    const hc = result.healthCheck;
    const feverMarker = hc.temperature >= 37.3 ? '🌡️' : '✅';
    return `${feverMarker} ${hc.temperature}°C ${
      hc.isIsolated ? '已隔离' : ''
    } 检查人:${hc.checker}`;
  }

  private formatMedication(result: ReconciliationResult): string {
    if (!result.medication) {
      return '无授权';
    }
    const med = result.medication;
    const confirmMarker = med.parentConfirmed ? '✅' : '❌';
    const expiryMarker =
      new Date(med.expiryDate) < new Date() ? '⚠️' : '✅';
    return `${confirmMarker}${expiryMarker} ${med.medicationName} (有效期至:${med.expiryDate})`;
  }

  private translateStatus(status: RecordStatus): string {
    const mapping: Record<RecordStatus, string> = {
      PENDING: '待处理',
      APPROVED: '已通过',
      REJECTED: '已驳回',
      NEEDS_MORE_INFO: '需补材料',
    };
    return mapping[status];
  }

  private translateSeverity(severity: 'HIGH' | 'MEDIUM' | 'LOW'): string {
    const mapping = {
      HIGH: '高风险',
      MEDIUM: '中风险',
      LOW: '低风险',
    };
    return mapping[severity];
  }

  exportTextReport(report: ExportReport, filePath: string): void {
    const text = this.generateTextReport(report);
    fs.writeFileSync(filePath, text, 'utf-8');
  }
}