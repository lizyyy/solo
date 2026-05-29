import * as fs from 'fs';
import * as path from 'path';
import { RegressionReport, IssueSeverity, Issue } from '../types';
import chalk from 'chalk';
import { table } from 'table';
import * as ExcelJS from 'exceljs';

export class ReportGenerator {
  static generateTerminalSummary(report: RegressionReport): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push(chalk.bold.cyan('═'.repeat(80)));
    lines.push(chalk.bold.cyan('埋点事件回归报告'));
    lines.push(chalk.bold.cyan('═'.repeat(80)));
    lines.push('');
    
    lines.push(`${chalk.bold('报告ID:')} ${report.id}`);
    lines.push(`${chalk.bold('标题:')} ${report.title}`);
    lines.push(`${chalk.bold('生成时间:')} ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
    lines.push(`${chalk.bold('清单版本:')} ${report.manifestVersion}`);
    lines.push(`${chalk.bold('发版号:')} ${report.releaseVersion}`);
    lines.push('');

    const statusData = [
      [chalk.bold('状态'), chalk.bold('数量'), chalk.bold('百分比')],
      [chalk.green('通过'), report.passedEvents.toString(), this.calcPercent(report.passedEvents, report.totalEvents)],
      [chalk.red('失败'), report.failedEvents.toString(), this.calcPercent(report.failedEvents, report.totalEvents)],
      [chalk.yellow('警告'), report.warningEvents.toString(), this.calcPercent(report.warningEvents, report.totalEvents)],
      [chalk.gray('缺失'), report.missingEvents.toString(), this.calcPercent(report.missingEvents, report.totalEvents)],
      [chalk.bold('总计'), report.totalEvents.toString(), '100%']
    ];
    lines.push(table(statusData, {
      header: {
        alignment: 'center',
        content: chalk.bold('事件状态统计')
      }
    }));

    const severityData = [
      [chalk.bold('严重级别'), chalk.bold('数量')],
      [chalk.bgRed.white(' CRITICAL '), report.summary.critical.toString()],
      [chalk.red('HIGH'), report.summary.high.toString()],
      [chalk.yellow('MEDIUM'), report.summary.medium.toString()],
      [chalk.blue('LOW'), report.summary.low.toString()],
      [chalk.gray('INFO'), report.summary.info.toString()]
    ];
    lines.push(table(severityData, {
      header: {
        alignment: 'center',
        content: chalk.bold('问题严重级别统计')
      }
    }));

    if (report.versionComparison) {
      const vc = report.versionComparison;
      lines.push(chalk.bold('版本对比:'));
      lines.push(`  基准版本: ${vc.baseVersion} → 目标版本: ${vc.targetVersion}`);
      lines.push(`  新增事件: ${vc.newEvents.length} | 删除事件: ${vc.removedEvents.length} | 修改事件: ${vc.modifiedEvents.length}`);
      if (vc.renamedEvents.length > 0) {
        lines.push(`  改名事件: ${vc.renamedEvents.length}`);
      }
      if (vc.parameterChanges.length > 0) {
        lines.push(`  参数变更: ${vc.parameterChanges.length}`);
      }
      lines.push('');
    }

    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    const highIssues = report.issues.filter(i => i.severity === 'high');
    
    if (criticalIssues.length > 0) {
      lines.push(chalk.bold.bgRed.white('  CRITICAL 问题 '));
      lines.push('');
      for (const issue of criticalIssues.slice(0, 5)) {
        lines.push(this.formatIssueTerminal(issue, 'critical'));
      }
      if (criticalIssues.length > 5) {
        lines.push(chalk.gray(`  ... 还有 ${criticalIssues.length - 5} 个 critical 问题`));
      }
      lines.push('');
    }

    if (highIssues.length > 0) {
      lines.push(chalk.bold.red('  HIGH 问题 '));
      lines.push('');
      for (const issue of highIssues.slice(0, 5)) {
        lines.push(this.formatIssueTerminal(issue, 'high'));
      }
      if (highIssues.length > 5) {
        lines.push(chalk.gray(`  ... 还有 ${highIssues.length - 5} 个 high 问题`));
      }
      lines.push('');
    }

    const passRate = ((report.passedEvents / report.totalEvents) * 100).toFixed(1);
    const hasBlockingIssues = report.summary.critical > 0 || report.summary.high > 0;
    
    lines.push(chalk.bold('结论:'));
    if (hasBlockingIssues) {
      lines.push(chalk.red(`  ❌ 不通过 - 存在阻断性问题 (${report.summary.critical} critical, ${report.summary.high} high)`));
    } else if (report.summary.medium > 0 || report.summary.low > 0) {
      lines.push(chalk.yellow(`  ⚠️  通过但有警告 - 通过率 ${passRate}%`));
    } else {
      lines.push(chalk.green(`  ✅  全部通过 - 通过率 100%`));
    }
    lines.push('');

    return lines.join('\n');
  }

  private static formatIssueTerminal(issue: Issue, severity: IssueSeverity): string {
    const color = severity === 'critical' ? chalk.bgRed.white : chalk.red;
    const lines: string[] = [];
    
    lines.push(`  ${color(` [${issue.type.toUpperCase()}] `)} ${issue.message}`);
    lines.push(chalk.gray(`    原因: ${issue.reason}`));
    lines.push(chalk.gray(`    影响范围: ${issue.impactScope.join(' | ')}`));
    lines.push(chalk.cyan(`    下一步: ${issue.nextActions[0]}`));
    lines.push('');
    
    return lines.join('\n');
  }

  private static calcPercent(value: number, total: number): string {
    if (total === 0) return '0%';
    return ((value / total) * 100).toFixed(1) + '%';
  }

  static generateJson(report: RegressionReport): string {
    return JSON.stringify(report, null, 2);
  }

  static generateMarkdown(report: RegressionReport): string {
    const lines: string[] = [];
    
    lines.push(`# ${report.title}`);
    lines.push('');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 报告ID | ${report.id} |`);
    lines.push(`| 生成时间 | ${new Date(report.generatedAt).toLocaleString('zh-CN')} |`);
    lines.push(`| 清单版本 | ${report.manifestVersion} |`);
    lines.push(`| 发版号 | ${report.releaseVersion} |`);
    lines.push('');

    lines.push('## 事件状态统计');
    lines.push('');
    lines.push('| 状态 | 数量 | 百分比 |');
    lines.push('|------|------|--------|');
    lines.push(`| ✅ 通过 | ${report.passedEvents} | ${this.calcPercent(report.passedEvents, report.totalEvents)} |`);
    lines.push(`| ❌ 失败 | ${report.failedEvents} | ${this.calcPercent(report.failedEvents, report.totalEvents)} |`);
    lines.push(`| ⚠️ 警告 | ${report.warningEvents} | ${this.calcPercent(report.warningEvents, report.totalEvents)} |`);
    lines.push(`| ⚫ 缺失 | ${report.missingEvents} | ${this.calcPercent(report.missingEvents, report.totalEvents)} |`);
    lines.push(`| **总计** | **${report.totalEvents}** | **100%** |`);
    lines.push('');

    lines.push('## 问题严重级别统计');
    lines.push('');
    lines.push('| 严重级别 | 数量 |');
    lines.push('|----------|------|');
    lines.push(`| 🔴 CRITICAL | ${report.summary.critical} |`);
    lines.push(`| 🟠 HIGH | ${report.summary.high} |`);
    lines.push(`| 🟡 MEDIUM | ${report.summary.medium} |`);
    lines.push(`| 🔵 LOW | ${report.summary.low} |`);
    lines.push(`| ⚪ INFO | ${report.summary.info} |`);
    lines.push('');

    if (report.versionComparison) {
      const vc = report.versionComparison;
      lines.push('## 版本对比');
      lines.push('');
      lines.push(`**${vc.baseVersion}** → **${vc.targetVersion}**`);
      lines.push('');
      lines.push(`- 新增事件: ${vc.newEvents.length}`);
      lines.push(`- 删除事件: ${vc.removedEvents.length}`);
      lines.push(`- 修改事件: ${vc.modifiedEvents.length}`);
      if (vc.renamedEvents.length > 0) {
        lines.push(`- 改名事件: ${vc.renamedEvents.length}`);
        for (const renamed of vc.renamedEvents) {
          lines.push(`  - \`${renamed.from}\` → \`${renamed.to}\``);
        }
      }
      if (vc.parameterChanges.length > 0) {
        lines.push(`- 参数变更: ${vc.parameterChanges.length}`);
      }
      lines.push('');
    }

    lines.push('## 问题详情');
    lines.push('');

    const severityOrder: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    const severityLabels: Record<IssueSeverity, string> = {
      critical: '🔴 CRITICAL',
      high: '🟠 HIGH',
      medium: '🟡 MEDIUM',
      low: '🔵 LOW',
      info: '⚪ INFO'
    };

    for (const severity of severityOrder) {
      const issues = report.issues.filter(i => i.severity === severity);
      if (issues.length === 0) continue;

      lines.push(`### ${severityLabels[severity]} (${issues.length})`);
      lines.push('');

      for (const issue of issues) {
        lines.push(`#### ${issue.message}`);
        lines.push('');
        lines.push(`- **类型**: \`${issue.type}\``);
        if (issue.eventId) lines.push(`- **事件ID**: \`${issue.eventId}\``);
        if (issue.eventName) lines.push(`- **事件名称**: ${issue.eventName}`);
        lines.push(`- **原因**: ${issue.reason}`);
        lines.push(`- **影响范围**: ${issue.impactScope.join(', ')}`);
        lines.push('- **下一步动作**:');
        for (const action of issue.nextActions) {
          lines.push(`  ${action}`);
        }
        if (issue.expected !== undefined || issue.actual !== undefined) {
          lines.push('- **对比**:');
          if (issue.expected !== undefined) {
            lines.push(`  - 期望: \`${JSON.stringify(issue.expected)}\``);
          }
          if (issue.actual !== undefined) {
            lines.push(`  - 实际: \`${JSON.stringify(issue.actual)}\``);
          }
        }
        if (issue.notes) {
          lines.push(`- **备注**: ${issue.notes}`);
        }
        lines.push('');
      }
    }

    lines.push('## 事件验证结果');
    lines.push('');
    lines.push('| 事件ID | 事件名称 | 状态 | 采样数 | 页面路径匹配 |');
    lines.push('|--------|----------|------|--------|--------------|');
    
    for (const result of report.results) {
      const statusEmoji = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : result.status === 'warning' ? '⚠️' : '⚫';
      const pageMatch = result.pagePathMatch ? '✅' : '❌';
      lines.push(`| ${result.eventId} | ${result.eventName} | ${statusEmoji} ${result.status} | ${result.sampleCount} | ${pageMatch} |`);
    }
    lines.push('');

    if (report.notes) {
      lines.push('## 备注');
      lines.push('');
      lines.push(report.notes);
      lines.push('');
    }

    if (report.manualCorrections && report.manualCorrections.length > 0) {
      lines.push('## 人工更正');
      lines.push('');
      for (const correction of report.manualCorrections) {
        lines.push(`- **事件ID**: ${correction.eventId}`);
        lines.push(`  - 更正类型: ${correction.correctionType}`);
        lines.push(`  - 原因: ${correction.reason}`);
        lines.push(`  - 更正人: ${correction.correctedBy}`);
        lines.push(`  - 时间: ${new Date(correction.correctedAt).toLocaleString('zh-CN')}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  static generateHtml(report: RegressionReport): string {
    const passRate = ((report.passedEvents / report.totalEvents) * 100).toFixed(1);
    const hasBlockingIssues = report.summary.critical > 0 || report.summary.high > 0;
    const statusColor = hasBlockingIssues ? 'danger' : report.summary.medium > 0 ? 'warning' : 'success';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 30px; background: #fafafa; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat-card .number { font-size: 36px; font-weight: bold; }
    .stat-card .label { color: #666; margin-top: 8px; }
    .stat-card.pass .number { color: #52c41a; }
    .stat-card.fail .number { color: #ff4d4f; }
    .stat-card.warning .number { color: #faad14; }
    .stat-card.missing .number { color: #8c8c8c; }
    .severity-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; font-size: 12px; }
    .severity-critical { background: #ff4d4f; color: white; }
    .severity-high { background: #ff7a45; color: white; }
    .severity-medium { background: #faad14; color: white; }
    .severity-low { background: #1890ff; color: white; }
    .severity-info { background: #8c8c8c; color: white; }
    .section { padding: 30px; border-bottom: 1px solid #eee; }
    .section h2 { font-size: 20px; margin-bottom: 20px; color: #333; }
    .section h3 { font-size: 16px; margin: 20px 0 10px; color: #555; }
    .issue { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 20px; margin-bottom: 15px; }
    .issue-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .issue-title { font-weight: bold; font-size: 16px; }
    .issue-meta { color: #666; font-size: 13px; margin-bottom: 10px; }
    .issue-section { margin-top: 10px; }
    .issue-section h4 { font-size: 13px; color: #888; margin-bottom: 5px; }
    .issue-section ul { margin-left: 20px; color: #555; }
    .issue-section li { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-weight: 600; }
    tr:hover { background: #fafafa; }
    .status-pass { color: #52c41a; }
    .status-fail { color: #ff4d4f; }
    .status-warning { color: #faad14; }
    .status-missing { color: #8c8c8c; }
    .conclusion { padding: 30px; background: ${statusColor === 'danger' ? '#fff1f0' : statusColor === 'warning' ? '#fffbe6' : '#f6ffed'}; }
    .conclusion h2 { margin-bottom: 15px; }
    .conclusion-text { font-size: 18px; font-weight: bold; color: ${statusColor === 'danger' ? '#ff4d4f' : statusColor === 'warning' ? '#faad14' : '#52c41a'}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${report.title}</h1>
      <div class="meta">
        报告ID: ${report.id} | 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')} | 发版号: ${report.releaseVersion}
      </div>
    </div>

    <div class="summary">
      <div class="stat-card pass">
        <div class="number">${report.passedEvents}</div>
        <div class="label">✅ 通过</div>
      </div>
      <div class="stat-card fail">
        <div class="number">${report.failedEvents}</div>
        <div class="label">❌ 失败</div>
      </div>
      <div class="stat-card warning">
        <div class="number">${report.warningEvents}</div>
        <div class="label">⚠️ 警告</div>
      </div>
      <div class="stat-card missing">
        <div class="number">${report.missingEvents}</div>
        <div class="label">⚫ 缺失</div>
      </div>
    </div>

    <div class="section">
      <h2>问题严重级别</h2>
      <table>
        <tr><th>级别</th><th>数量</th></tr>
        <tr><td><span class="severity-badge severity-critical">CRITICAL</span></td><td>${report.summary.critical}</td></tr>
        <tr><td><span class="severity-badge severity-high">HIGH</span></td><td>${report.summary.high}</td></tr>
        <tr><td><span class="severity-badge severity-medium">MEDIUM</span></td><td>${report.summary.medium}</td></tr>
        <tr><td><span class="severity-badge severity-low">LOW</span></td><td>${report.summary.low}</td></tr>
        <tr><td><span class="severity-badge severity-info">INFO</span></td><td>${report.summary.info}</td></tr>
      </table>
    </div>

    ${report.versionComparison ? `
    <div class="section">
      <h2>版本对比: ${report.versionComparison.baseVersion} → ${report.versionComparison.targetVersion}</h2>
      <table>
        <tr><th>变更类型</th><th>数量</th></tr>
        <tr><td>新增事件</td><td>${report.versionComparison.newEvents.length}</td></tr>
        <tr><td>删除事件</td><td>${report.versionComparison.removedEvents.length}</td></tr>
        <tr><td>修改事件</td><td>${report.versionComparison.modifiedEvents.length}</td></tr>
        <tr><td>改名事件</td><td>${report.versionComparison.renamedEvents.length}</td></tr>
        <tr><td>参数变更</td><td>${report.versionComparison.parameterChanges.length}</td></tr>
      </table>
    </div>` : ''}

    <div class="section">
      <h2>问题详情</h2>
      ${report.issues.length === 0 ? '<p>没有发现问题 🎉</p>' : ''}
      ${report.issues.map(issue => `
        <div class="issue">
          <div class="issue-header">
            <span class="severity-badge severity-${issue.severity}">${issue.severity.toUpperCase()}</span>
            <span class="issue-title">${issue.message}</span>
          </div>
          <div class="issue-meta">
            类型: ${issue.type} | ${issue.eventId ? `事件: ${issue.eventId}` : ''}
          </div>
          <div class="issue-section">
            <h4>原因</h4>
            <p>${issue.reason}</p>
          </div>
          <div class="issue-section">
            <h4>影响范围</h4>
            <ul>${issue.impactScope.map(s => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="issue-section">
            <h4>下一步动作</h4>
            <ul>${issue.nextActions.map(a => `<li>${a}</li>`).join('')}</ul>
          </div>
          ${issue.expected !== undefined || issue.actual !== undefined ? `
          <div class="issue-section">
            <h4>对比</h4>
            <ul>
              ${issue.expected !== undefined ? `<li>期望: <code>${JSON.stringify(issue.expected)}</code></li>` : ''}
              ${issue.actual !== undefined ? `<li>实际: <code>${JSON.stringify(issue.actual)}</code></li>` : ''}
            </ul>
          </div>` : ''}
        </div>
      `).join('')}
    </div>

    <div class="section">
      <h2>事件验证结果</h2>
      <table>
        <tr><th>事件ID</th><th>事件名称</th><th>状态</th><th>采样数</th><th>页面匹配</th></tr>
        ${report.results.map(r => `
          <tr>
            <td><code>${r.eventId}</code></td>
            <td>${r.eventName}</td>
            <td class="status-${r.status}">${r.status}</td>
            <td>${r.sampleCount}</td>
            <td>${r.pagePathMatch ? '✅' : '❌'}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <div class="conclusion">
      <h2>结论</h2>
      <div class="conclusion-text">
        ${hasBlockingIssues ? '❌ 不通过 - 存在阻断性问题，请优先修复 critical 和 high 级别的问题' :
          report.summary.medium > 0 || report.summary.low > 0 ? `⚠️ 通过但有警告 - 通过率 ${passRate}%，建议关注中低级别的问题` :
          `✅ 全部通过 - 通过率 100%，埋点完整，可以发版！`}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  static async generateExcel(report: RegressionReport, filePath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tracker Regression CLI';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('概览');
    summarySheet.columns = [
      { header: '指标', key: 'metric', width: 30 },
      { header: '值', key: 'value', width: 50 }
    ];
    summarySheet.addRow({ metric: '报告标题', value: report.title });
    summarySheet.addRow({ metric: '报告ID', value: report.id });
    summarySheet.addRow({ metric: '生成时间', value: new Date(report.generatedAt).toLocaleString('zh-CN') });
    summarySheet.addRow({ metric: '清单版本', value: report.manifestVersion });
    summarySheet.addRow({ metric: '发版号', value: report.releaseVersion });
    summarySheet.addRow({});
    summarySheet.addRow({ metric: '总事件数', value: report.totalEvents });
    summarySheet.addRow({ metric: '通过', value: report.passedEvents });
    summarySheet.addRow({ metric: '失败', value: report.failedEvents });
    summarySheet.addRow({ metric: '警告', value: report.warningEvents });
    summarySheet.addRow({ metric: '缺失', value: report.missingEvents });
    summarySheet.addRow({});
    summarySheet.addRow({ metric: 'CRITICAL', value: report.summary.critical });
    summarySheet.addRow({ metric: 'HIGH', value: report.summary.high });
    summarySheet.addRow({ metric: 'MEDIUM', value: report.summary.medium });
    summarySheet.addRow({ metric: 'LOW', value: report.summary.low });
    summarySheet.addRow({ metric: 'INFO', value: report.summary.info });

    const issuesSheet = workbook.addWorksheet('问题详情');
    issuesSheet.columns = [
      { header: 'ID', key: 'id', width: 20 },
      { header: '严重级别', key: 'severity', width: 12 },
      { header: '类型', key: 'type', width: 20 },
      { header: '事件ID', key: 'eventId', width: 20 },
      { header: '事件名称', key: 'eventName', width: 25 },
      { header: '消息', key: 'message', width: 50 },
      { header: '原因', key: 'reason', width: 60 },
      { header: '影响范围', key: 'impactScope', width: 50 },
      { header: '下一步', key: 'nextActions', width: 60 }
    ];
    for (const issue of report.issues) {
      issuesSheet.addRow({
        id: issue.id,
        severity: issue.severity.toUpperCase(),
        type: issue.type,
        eventId: issue.eventId || '',
        eventName: issue.eventName || '',
        message: issue.message,
        reason: issue.reason,
        impactScope: issue.impactScope.join('; '),
        nextActions: issue.nextActions.join(' ')
      });
    }

    const resultsSheet = workbook.addWorksheet('事件结果');
    resultsSheet.columns = [
      { header: '事件ID', key: 'eventId', width: 20 },
      { header: '事件名称', key: 'eventName', width: 25 },
      { header: '状态', key: 'status', width: 10 },
      { header: '采样数', key: 'sampleCount', width: 10 },
      { header: '页面路径匹配', key: 'pagePathMatch', width: 15 },
      { header: '期望路径', key: 'expectedPagePath', width: 30 },
      { header: '实际路径', key: 'actualPagePath', width: 30 },
      { header: '问题数', key: 'issueCount', width: 10 }
    ];
    for (const result of report.results) {
      resultsSheet.addRow({
        eventId: result.eventId,
        eventName: result.eventName,
        status: result.status,
        sampleCount: result.sampleCount,
        pagePathMatch: result.pagePathMatch ? '是' : '否',
        expectedPagePath: result.expectedPagePath || '',
        actualPagePath: result.actualPagePath || '',
        issueCount: result.issues.length
      });
    }

    await workbook.xlsx.writeFile(filePath);
  }

  static writeToFile(content: string, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
