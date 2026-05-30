import db from '../db/index.js';
import type { DrillReport, HitResult, Anomaly, Tier, HitReason, ReportStatus } from '../../shared/types.js';

export class ReportService {
  static getReports(): DrillReport[] {
    const stmt = db.prepare(`
      SELECT id, name, ruleId, ruleName, ruleVersion, startTime, endTime, sampleRate, totalRequests, hitCount, blockedCustomers, anomalies, conclusion, status, createdAt
      FROM drill_reports
      ORDER BY createdAt DESC
      LIMIT 100
    `);

    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      ruleId: string;
      ruleName: string;
      ruleVersion: number;
      startTime: string;
      endTime: string;
      sampleRate: number;
      totalRequests: number;
      hitCount: number;
      blockedCustomers: string;
      anomalies: string;
      conclusion: string;
      status: string;
      createdAt: string;
    }>;

    return rows.map(row => ({
      ...row,
      blockedCustomers: JSON.parse(row.blockedCustomers),
      anomalies: JSON.parse(row.anomalies),
      status: row.status as ReportStatus,
      hitResults: []
    }));
  }

  static getReport(id: string): DrillReport | null {
    const stmt = db.prepare(`
      SELECT id, name, ruleId, ruleName, ruleVersion, startTime, endTime, sampleRate, totalRequests, hitCount, blockedCustomers, anomalies, conclusion, status, createdAt
      FROM drill_reports
      WHERE id = ?
    `);

    const row = stmt.get(id) as {
      id: string;
      name: string;
      ruleId: string;
      ruleName: string;
      ruleVersion: number;
      startTime: string;
      endTime: string;
      sampleRate: number;
      totalRequests: number;
      hitCount: number;
      blockedCustomers: string;
      anomalies: string;
      conclusion: string;
      status: string;
      createdAt: string;
    } | undefined;

    if (!row) return null;

    const hitsStmt = db.prepare(`
      SELECT id, requestId, ruleId, ruleVersion, customerId, customerName, customerTier, hitReason, explanation, wouldBlock, confidence, requestTimestamp, requestPath
      FROM hit_results
      WHERE reportId = ?
      ORDER BY requestTimestamp DESC
    `);

    const hitRows = hitsStmt.all(id) as Array<{
      id: string;
      requestId: string;
      ruleId: string;
      ruleVersion: number;
      customerId: string;
      customerName: string;
      customerTier: string;
      hitReason: string;
      explanation: string;
      wouldBlock: number;
      confidence: number;
      requestTimestamp: string;
      requestPath: string;
    }>;

    const hitResults: HitResult[] = hitRows.map(row => ({
      ...row,
      customerTier: row.customerTier as Tier,
      hitReason: row.hitReason as HitReason,
      wouldBlock: row.wouldBlock === 1
    }));

    return {
      ...row,
      blockedCustomers: JSON.parse(row.blockedCustomers),
      anomalies: JSON.parse(row.anomalies),
      status: row.status as ReportStatus,
      hitResults
    };
  }

  static exportReport(id: string, format: 'csv' | 'json'): { content: string; filename: string; contentType: string } {
    const report = this.getReport(id);
    if (!report) {
      throw new Error(`Report ${id} not found`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseFilename = `drill-report-${report.ruleName}-${timestamp}`;

    if (format === 'json') {
      return {
        content: JSON.stringify(report, null, 2),
        filename: `${baseFilename}.json`,
        contentType: 'application/json'
      };
    }

    return {
      content: this.generateCSV(report),
      filename: `${baseFilename}.csv`,
      contentType: 'text/csv; charset=utf-8'
    };
  }

  private static generateCSV(report: DrillReport): string {
    const headers = [
      '命中ID',
      '请求ID',
      '客户ID',
      '客户名称',
      '客户层级',
      '命中原因',
      '是否拦截',
      '置信度',
      '解释说明',
      '请求时间',
      '请求路径',
      '规则ID',
      '规则版本'
    ];

    const rows = report.hitResults.map(hit => [
      hit.id,
      hit.requestId,
      hit.customerId,
      hit.customerName,
      hit.customerTier,
      this.translateHitReason(hit.hitReason),
      hit.wouldBlock ? '是' : '否',
      (hit.confidence * 100).toFixed(1) + '%',
      hit.explanation,
      hit.requestTimestamp,
      hit.requestPath,
      hit.ruleId,
      hit.ruleVersion
    ]);

    const summary = [
      [],
      ['=== 演练报告摘要 ==='],
      [`报告ID: ${report.id}`],
      [`报告名称: ${report.name}`],
      [`规则: ${report.ruleName} (v${report.ruleVersion})`],
      [`时间范围: ${report.startTime} ~ ${report.endTime}`],
      [`采样率: ${(report.sampleRate * 100).toFixed(0)}%`],
      [`总请求数: ${report.totalRequests}`],
      [`命中次数: ${report.hitCount}`],
      [`命中率: ${report.totalRequests > 0 ? ((report.hitCount / report.totalRequests) * 100).toFixed(2) : 0}%`],
      [`被拦截客户数: ${report.blockedCustomers.length}`],
      [`异常数: ${report.anomalies.length}`],
      [],
      ['=== 结论 ==='],
      [report.conclusion || '']
    ];

    if (report.anomalies.length > 0) {
      summary.push([], ['=== 异常列表 ==='], ['类型', '严重程度', '消息', '建议']);
      for (const anomaly of report.anomalies) {
        summary.push([
          this.translateAnomalyType(anomaly.type),
          this.translateSeverity(anomaly.severity),
          anomaly.message,
          anomaly.recommendation
        ]);
      }
    }

    const csvLines = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(',')),
      ...summary.map(row => row.map(cell => this.escapeCSV(cell)).join(','))
    ];

    const BOM = '\uFEFF';
    return BOM + csvLines.join('\n');
  }

  private static translateHitReason(reason: HitReason): string {
    const labels: Record<HitReason, string> = {
      threshold_exceeded: '阈值超限',
      whitelist_expired: '白名单过期',
      window_overlap: '时间窗重叠',
      false_positive: '疑似误杀'
    };
    return labels[reason] || reason;
  }

  private static translateAnomalyType(type: string): string {
    const labels: Record<string, string> = {
      whitelist_expired: '白名单过期',
      window_overlap: '时间窗重叠',
      false_positive: '疑似误杀'
    };
    return labels[type] || type;
  }

  private static translateSeverity(severity: string): string {
    const labels: Record<string, string> = {
      critical: '严重',
      warning: '警告',
      info: '提示'
    };
    return labels[severity] || severity;
  }

  private static escapeCSV(value: string | number): string {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export default ReportService;
