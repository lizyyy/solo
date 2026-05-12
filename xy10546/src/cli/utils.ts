import chalk from 'chalk';
import Table from 'cli-table3';
import { CheckIssue, CheckResult, InvoiceCheckReport } from '../types';

export const colors = {
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  highlight: chalk.cyan,
  muted: chalk.gray,
  bold: chalk.bold
};

export function formatResult(result: CheckResult): string {
  const map: Record<CheckResult, { label: string; color: chalk.Chalk }> = {
    auto_pass: { label: '自动通过', color: colors.success },
    needs_reissue: { label: '需补开', color: colors.error },
    manual_review: { label: '人工复核', color: colors.warning },
    correction_suggested: { label: '纠错建议', color: colors.info }
  };
  
  const r = map[result];
  return r.color(`[${r.label}]`);
}

export function formatSeverity(severity: 'error' | 'warning' | 'info'): string {
  const map = {
    error: { label: '错误', color: colors.error },
    warning: { label: '警告', color: colors.warning },
    info: { label: '提示', color: colors.info }
  };
  
  const s = map[severity];
  return s.color(s.label);
}

export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
}

export function createSummaryTable(reports: InvoiceCheckReport[]): any {
  const table = new Table({
    head: [
      colors.bold('发票号'),
      colors.bold('报销单号'),
      colors.bold('结果'),
      colors.bold('通过'),
      colors.bold('警告'),
      colors.bold('错误'),
      colors.bold('检查时间')
    ],
    colWidths: [20, 16, 14, 8, 8, 8, 22]
  });
  
  for (const r of reports) {
    table.push([
      r.invoiceNumber,
      r.reimbursementNumber || '-',
      formatResult(r.result),
      String(r.passCount),
      String(r.warnCount),
      String(r.errorCount),
      formatDate(r.checkedAt)
    ]);
  }
  
  return table;
}

export function createIssuesTable(issues: CheckIssue[]): any {
  const table = new Table({
    head: [
      colors.bold('类型'),
      colors.bold('标题'),
      colors.bold('描述'),
      colors.bold('建议')
    ],
    colWidths: [12, 24, 48, 40],
    wordWrap: true
  });
  
  for (const issue of issues) {
    table.push([
      formatSeverity(issue.severity),
      issue.title,
      issue.description,
      issue.suggestion || '-'
    ]);
  }
  
  return table;
}

export function printSection(title: string, content: string): void {
  console.log('\n' + colors.bold(`=== ${title} ===`));
  console.log(content);
}

export function printSuccess(message: string): void {
  console.log(colors.success(`✓ ${message}`));
}

export function printError(message: string): void {
  console.log(colors.error(`✗ ${message}`));
}

export function printWarning(message: string): void {
  console.log(colors.warning(`⚠ ${message}`));
}

export function printInfo(message: string): void {
  console.log(colors.info(`ℹ ${message}`));
}

export function printStatus(status: string, message: string): void {
  const statusMap: Record<string, chalk.Chalk> = {
    pending: colors.info,
    approved: colors.success,
    rejected: colors.error,
    needs_review: colors.warning,
    corrected: colors.highlight
  };
  
  const color = statusMap[status] || colors.muted;
  console.log(color(`[${status.toUpperCase()}] ${message}`));
}
