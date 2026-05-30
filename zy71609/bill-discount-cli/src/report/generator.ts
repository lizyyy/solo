import { CalculationResult, Anomaly, ReportEntry, Bill, Application, Quote } from '../types';
import { loadStore } from '../store/store';
import { getAnomalyStats, formatCategoryLabel, formatSeverityIcon } from '../anomaly/classifier';
import * as fs from 'fs';
import * as path from 'path';

export function generateReport(): ReportEntry[] {
  const store = loadStore();
  const entries: ReportEntry[] = [];

  for (const calc of store.calculations) {
    const bill = store.bills.find((b) => b.billNo === calc.billNo);
    const app = store.applications.find((a) => a.appId === calc.appId);

    entries.push({
      billNo: calc.billNo,
      appId: calc.appId,
      drawer: bill?.drawer || '',
      acceptor: bill?.acceptor || '',
      amount: calc.amount,
      discountDate: calc.discountDate,
      maturityDate: calc.maturityDate,
      interestDays: calc.interestDays,
      appliedRate: calc.appliedRate,
      matchedRate: calc.matchedRate,
      discountInterest: calc.discountInterest,
      netAmount: calc.netAmount,
      rateDiff: calc.rateDiff,
      interestDiff: calc.interestDiff,
      anomalies: calc.anomalies,
      status: app?.status || 'unknown',
    });
  }

  return entries;
}

export function exportReport(entries: ReportEntry[], format: 'csv' | 'json', outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.resolve(outputDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (format === 'json') {
    const filePath = path.join(dir, `report-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf-8');
    return filePath;
  }

  const filePath = path.join(dir, `report-${timestamp}.csv`);
  const headers = [
    '票据号', '申请号', '出票人', '承兑人', '票面金额',
    '贴现日', '到期日', '计息天数', '申请利率', '匹配利率',
    '贴现利息', '净额', '利率差', '利息差', '状态', '异常数',
    '异常概要',
  ];

  const rows = entries.map((e) => [
    e.billNo,
    e.appId,
    e.drawer,
    e.acceptor,
    e.amount,
    e.discountDate,
    e.maturityDate,
    e.interestDays,
    e.appliedRate,
    e.matchedRate,
    e.discountInterest,
    e.netAmount,
    e.rateDiff,
    e.interestDiff,
    e.status,
    e.anomalies.length,
    e.anomalies.map((a) => `${formatSeverityIcon(a.severity)}[${formatCategoryLabel(a.category)}]${a.code}: ${a.message}`).join('; '),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((cell) => {
        const s = String(cell);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(',')
    ),
  ].join('\n');

  fs.writeFileSync(filePath, '\uFEFF' + csvContent, 'utf-8');
  return filePath;
}

export function generateAnomalySummary(): string {
  const store = loadStore();
  const stats = getAnomalyStats(store.anomalies);
  const lines: string[] = [];

  lines.push('=== 异常统计 ===');
  lines.push(`总计: ${stats.total} 条 (已解决: ${stats.resolved})`);
  lines.push('');
  lines.push(`按分类:`);
  lines.push(`  数据问题: ${stats.byCategory.data}`);
  lines.push(`  规则问题: ${stats.byCategory.rule}`);
  lines.push(`  材料缺失: ${stats.byCategory.material}`);
  lines.push('');
  lines.push(`按严重性:`);
  lines.push(`  错误: ${stats.bySeverity.error}`);
  lines.push(`  警告: ${stats.bySeverity.warning}`);
  lines.push(`  信息: ${stats.bySeverity.info}`);
  lines.push('');

  const unresolved = store.anomalies.filter((a) => !a.resolved);
  if (unresolved.length > 0) {
    lines.push('=== 未解决异常 ===');
    for (const a of unresolved) {
      lines.push(
        `${formatSeverityIcon(a.severity)} [${formatCategoryLabel(a.category)}] ${a.code}`
      );
      lines.push(`  票据号: ${a.billNo}`);
      lines.push(`  说明: ${a.message}`);
      lines.push(`  详情: ${a.detail}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}
