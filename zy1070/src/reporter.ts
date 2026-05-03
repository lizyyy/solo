import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import {
  Issue,
  IssueSeverity,
  IssueType,
  ReportData,
  Config,
  IssueExplanation,
} from './types';
import { getIssueExplanation, getAllIssueExplanations } from './analyzer';

export function generateJSONReport(
  issues: Issue[],
  config: Config,
  tokenStats: { total: number; defined: number; unused: number; missing: number }
): string {
  const report: ReportData = {
    timestamp: new Date().toISOString(),
    project: path.basename(config.projectRoot),
    config,
    summary: getSummary(issues),
    issues,
    tokens: tokenStats,
  };

  return JSON.stringify(report, null, 2);
}

export function generateMarkdownReport(
  issues: Issue[],
  config: Config,
  tokenStats: { total: number; defined: number; unused: number; missing: number }
): string {
  const summary = getSummary(issues);
  const groups = groupBySeverity(issues);

  let md = `# Design Token 漂移检测报告\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  md += `## 📊 概览\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| **严重 (Critical)** | ${summary.critical} |\n`;
  md += `| **高 (High)** | ${summary.high} |\n`;
  md += `| **中 (Medium)** | ${summary.medium} |\n`;
  md += `| **低 (Low)** | ${summary.low} |\n`;
  md += `| **总计** | ${summary.total} |\n\n`;

  md += `## 🎨 Token 统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| **总 Token 数** | ${tokenStats.total} |\n`;
  md += `| **已定义** | ${tokenStats.defined} |\n`;
  md += `| **未使用** | ${tokenStats.unused} |\n`;
  md += `| **缺失引用** | ${tokenStats.missing} |\n\n`;

  const severityOrder: IssueSeverity[] = [
    IssueSeverity.CRITICAL,
    IssueSeverity.HIGH,
    IssueSeverity.MEDIUM,
    IssueSeverity.LOW,
  ];

  for (const severity of severityOrder) {
    const severityIssues = groups[severity];
    if (severityIssues.length === 0) continue;

    const severityLabel = getSeverityLabel(severity);
    md += `## ${getSeverityEmoji(severity)} ${severityLabel} (${severityIssues.length})\n\n`;

    const byType = groupByType(severityIssues);

    for (const [type, typeIssues] of Object.entries(byType)) {
      const explanation = getIssueExplanation(type as IssueType);
      md += `### ${explanation.title}\n\n`;
      md += `> ${explanation.description}\n\n`;

      for (const issue of typeIssues) {
        md += `#### ${issue.id}\n\n`;
        md += `- **描述**: ${issue.description}\n`;
        
        if (issue.file) {
          md += `- **文件**: \`${issue.file}\``;
          if (issue.line) {
            md += ` (行 ${issue.line})`;
          }
          md += `\n`;
        }

        if (issue.context) {
          md += `- **上下文**: \`${issue.context}\`\n`;
        }

        if (issue.tokenName) {
          md += `- **Token**: \`${issue.tokenName}\`\n`;
        }

        if (issue.actualValue) {
          md += `- **当前值**: \`${issue.actualValue}\`\n`;
        }

        if (issue.themes) {
          md += `- **缺失主题**: ${issue.themes.join(', ')}\n`;
        }

        md += `\n`;
      }
    }
  }

  md += `---\n\n`;
  md += `## 📖 问题类型说明\n\n`;

  const allExplanations = getAllIssueExplanations();
  for (const exp of allExplanations) {
    md += `### ${exp.title}\n\n`;
    md += `- **严重程度**: ${getSeverityLabel(exp.severity)}\n`;
    md += `- **描述**: ${exp.description}\n\n`;

    md += `**示例**:\n\n`;
    for (const example of exp.examples) {
      md += `\`\`\`typescript\n// ❌ 不推荐\n${example.bad}\n\n// ✅ 推荐\n${example.good}\n\`\`\`\n\n`;
      md += `> ${example.explanation}\n\n`;
    }
  }

  return md;
}

export function generateHTMLReport(
  issues: Issue[],
  config: Config,
  tokenStats: { total: number; defined: number; unused: number; missing: number }
): string {
  const summary = getSummary(issues);
  const groups = groupBySeverity(issues);

  const severityColors: Record<IssueSeverity, string> = {
    [IssueSeverity.CRITICAL]: '#ef4444',
    [IssueSeverity.HIGH]: '#f97316',
    [IssueSeverity.MEDIUM]: '#eab308',
    [IssueSeverity.LOW]: '#22c55e',
  };

  const severityEmojis: Record<IssueSeverity, string> = {
    [IssueSeverity.CRITICAL]: '🔴',
    [IssueSeverity.HIGH]: '🟠',
    [IssueSeverity.MEDIUM]: '🟡',
    [IssueSeverity.LOW]: '🟢',
  };

  let issuesHTML = '';
  const severityOrder: IssueSeverity[] = [
    IssueSeverity.CRITICAL,
    IssueSeverity.HIGH,
    IssueSeverity.MEDIUM,
    IssueSeverity.LOW,
  ];

  for (const severity of severityOrder) {
    const severityIssues = groups[severity];
    if (severityIssues.length === 0) continue;

    const byType = groupByType(severityIssues);

    issuesHTML += `
      <div class="severity-section" data-severity="${severity}">
        <h2 style="color: ${severityColors[severity]}">
          ${severityEmojis[severity]} ${getSeverityLabel(severity)} 
          <span class="count">(${severityIssues.length})</span>
        </h2>
    `;

    for (const [type, typeIssues] of Object.entries(byType)) {
      const explanation = getIssueExplanation(type as IssueType);

      issuesHTML += `
        <div class="type-section">
          <h3>${explanation.title}</h3>
          <p class="description">${explanation.description}</p>
          <div class="issue-list">
      `;

      for (const issue of typeIssues) {
        issuesHTML += `
          <div class="issue-card">
            <div class="issue-header">
              <span class="issue-id">${issue.id}</span>
              ${issue.file ? `<span class="issue-file">${issue.file}${issue.line ? `:${issue.line}` : ''}</span>` : ''}
            </div>
            <p class="issue-desc">${issue.description}</p>
            ${issue.context ? `<pre class="issue-context"><code>${escapeHTML(issue.context)}</code></pre>` : ''}
            ${issue.tokenName ? `<p class="issue-token"><strong>Token:</strong> <code>${issue.tokenName}</code></p>` : ''}
            ${issue.actualValue ? `<p class="issue-value"><strong>当前值:</strong> <code>${issue.actualValue}</code></p>` : ''}
            ${issue.themes ? `<p class="issue-themes"><strong>缺失主题:</strong> ${issue.themes.join(', ')}</p>` : ''}
          </div>
        `;
      }

      issuesHTML += `
          </div>
        </div>
      `;
    }

    issuesHTML += `</div>`;
  }

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Design Token 漂移检测报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    
    .header h1 {
      font-size: 2rem;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      color: #666;
      font-size: 0.95rem;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
    }
    
    .stat-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      margin-bottom: 4px;
    }
    
    .stat-card .label {
      color: #666;
      font-size: 0.9rem;
    }
    
    .stat-card.critical .value { color: #ef4444; }
    .stat-card.high .value { color: #f97316; }
    .stat-card.medium .value { color: #eab308; }
    .stat-card.low .value { color: #22c55e; }
    .stat-card.total .value { color: #6366f1; }
    
    .content {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    }
    
    .severity-section {
      margin-bottom: 40px;
    }
    
    .severity-section h2 {
      font-size: 1.4rem;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .severity-section h2 .count {
      font-size: 1rem;
      font-weight: normal;
      color: #666;
    }
    
    .type-section {
      margin-bottom: 24px;
    }
    
    .type-section h3 {
      font-size: 1.1rem;
      color: #1a1a2e;
      margin-bottom: 8px;
    }
    
    .type-section .description {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 16px;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
      border-left: 3px solid #6366f1;
    }
    
    .issue-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .issue-card {
      background: #fafafa;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 16px;
      transition: all 0.2s;
    }
    
    .issue-card:hover {
      background: #f8fafc;
      border-color: #d1d5db;
    }
    
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .issue-id {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      color: #6366f1;
      font-weight: 600;
    }
    
    .issue-file {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.8rem;
      color: #9ca3af;
    }
    
    .issue-desc {
      color: #374151;
      margin-bottom: 8px;
    }
    
    .issue-context {
      background: #1a1a2e;
      color: #e5e7eb;
      padding: 12px;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      margin-bottom: 8px;
    }
    
    .issue-token,
    .issue-value,
    .issue-themes {
      font-size: 0.9rem;
      color: #6b7280;
      margin-top: 4px;
    }
    
    .issue-token code,
    .issue-value code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
    }
    
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 0.85rem;
    }
    
    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.5rem;
      }
      
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .stat-card .value {
        font-size: 2rem;
      }
      
      .issue-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 Design Token 漂移检测报告</h1>
      <p class="subtitle">项目: ${path.basename(config.projectRoot)} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="value">${summary.total}</div>
        <div class="label">总计问题</div>
      </div>
      <div class="stat-card critical">
        <div class="value">${summary.critical}</div>
        <div class="label">严重</div>
      </div>
      <div class="stat-card high">
        <div class="value">${summary.high}</div>
        <div class="label">高</div>
      </div>
      <div class="stat-card medium">
        <div class="value">${summary.medium}</div>
        <div class="label">中</div>
      </div>
      <div class="stat-card low">
        <div class="value">${summary.low}</div>
        <div class="label">低</div>
      </div>
    </div>
    
    <div class="content">
      ${issuesHTML || '<p style="text-align: center; color: #22c55e; padding: 40px; font-size: 1.2rem;">🎉 太棒了！没有发现任何问题。</p>'}
      
      <div class="footer">
        Token 统计: 总数 ${tokenStats.total} | 已定义 ${tokenStats.defined} | 未使用 ${tokenStats.unused} | 缺失引用 ${tokenStats.missing}
      </div>
    </div>
  </div>
</body>
</html>
`;

  return html;
}

export function printTerminalSummary(issues: Issue[]): void {
  const summary = getSummary(issues);
  const groups = groupBySeverity(issues);

  console.log('\n');
  console.log(chalk.bold('📊 Design Token 漂移检测结果'));
  console.log('='.repeat(50));
  console.log('\n');

  const severityOrder: IssueSeverity[] = [
    IssueSeverity.CRITICAL,
    IssueSeverity.HIGH,
    IssueSeverity.MEDIUM,
    IssueSeverity.LOW,
  ];

  const summaryData = [
    [chalk.bold('严重程度'), chalk.bold('数量')],
    [chalk.red('Critical (严重)'), chalk.red.bold(String(summary.critical))],
    [chalk.yellow('High (高)'), chalk.yellow.bold(String(summary.high))],
    [chalk.blue('Medium (中)'), chalk.blue.bold(String(summary.medium))],
    [chalk.green('Low (低)'), chalk.green.bold(String(summary.low))],
    [chalk.bold('总计'), chalk.bold(String(summary.total))],
  ];

  console.log(table(summaryData));

  if (issues.length > 0) {
    console.log('\n');
    console.log(chalk.bold('📍 问题详情 (前 10 条)'));
    console.log('-'.repeat(50));

    const previewIssues = issues.slice(0, 10);

    for (const issue of previewIssues) {
      const severityColor = getSeverityColor(issue.severity);
      const typeExplanation = getIssueExplanation(issue.type);

      console.log('\n');
      console.log(severityColor(`[${getSeverityLabel(issue.severity)}] ${typeExplanation.title}`));
      console.log(`  ID: ${chalk.gray(issue.id)}`);

      if (issue.file) {
        let fileInfo = `  文件: ${chalk.cyan(issue.file)}`;
        if (issue.line) {
          fileInfo += chalk.gray(`:${issue.line}`);
        }
        console.log(fileInfo);
      }

      console.log(`  描述: ${issue.description}`);

      if (issue.context) {
        console.log(`  上下文: ${chalk.gray(issue.context)}`);
      }

      if (issue.actualValue) {
        console.log(`  当前值: ${chalk.magenta(issue.actualValue)}`);
      }
    }

    if (issues.length > 10) {
      console.log('\n');
      console.log(chalk.gray(`  ... 还有 ${issues.length - 10} 个问题，请使用 report 命令查看完整报告`));
    }
  } else {
    console.log('\n');
    console.log(chalk.green.bold('🎉 太棒了！没有发现任何问题。'));
  }

  console.log('\n');
}

function getSummary(issues: Issue[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const groups = groupBySeverity(issues);
  return {
    total: issues.length,
    critical: groups[IssueSeverity.CRITICAL].length,
    high: groups[IssueSeverity.HIGH].length,
    medium: groups[IssueSeverity.MEDIUM].length,
    low: groups[IssueSeverity.LOW].length,
  };
}

function groupBySeverity(issues: Issue[]): Record<IssueSeverity, Issue[]> {
  const groups: Record<IssueSeverity, Issue[]> = {
    [IssueSeverity.CRITICAL]: [],
    [IssueSeverity.HIGH]: [],
    [IssueSeverity.MEDIUM]: [],
    [IssueSeverity.LOW]: [],
  };

  for (const issue of issues) {
    groups[issue.severity].push(issue);
  }

  return groups;
}

function groupByType(issues: Issue[]): Record<IssueType, Issue[]> {
  const groups = {} as Record<IssueType, Issue[]>;

  for (const issue of issues) {
    if (!groups[issue.type]) {
      groups[issue.type] = [];
    }
    groups[issue.type].push(issue);
  }

  return groups;
}

function getSeverityLabel(severity: IssueSeverity): string {
  const labels: Record<IssueSeverity, string> = {
    [IssueSeverity.CRITICAL]: '严重',
    [IssueSeverity.HIGH]: '高',
    [IssueSeverity.MEDIUM]: '中',
    [IssueSeverity.LOW]: '低',
  };
  return labels[severity];
}

function getSeverityEmoji(severity: IssueSeverity): string {
  const emojis: Record<IssueSeverity, string> = {
    [IssueSeverity.CRITICAL]: '🔴',
    [IssueSeverity.HIGH]: '🟠',
    [IssueSeverity.MEDIUM]: '🟡',
    [IssueSeverity.LOW]: '🟢',
  };
  return emojis[severity];
}

function getSeverityColor(severity: IssueSeverity): chalk.Chalk {
  const colors: Record<IssueSeverity, chalk.Chalk> = {
    [IssueSeverity.CRITICAL]: chalk.red.bold,
    [IssueSeverity.HIGH]: chalk.yellow.bold,
    [IssueSeverity.MEDIUM]: chalk.blue.bold,
    [IssueSeverity.LOW]: chalk.green.bold,
  };
  return colors[severity];
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function writeReports(
  issues: Issue[],
  config: Config,
  tokenStats: { total: number; defined: number; unused: number; missing: number },
  formats: string[] = ['json', 'markdown', 'html']
): Promise<string[]> {
  const outputDir = path.resolve(config.projectRoot, config.outputDir);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const writtenFiles: string[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  if (formats.includes('json')) {
    const jsonContent = generateJSONReport(issues, config, tokenStats);
    const jsonPath = path.join(outputDir, `token-drift-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
    writtenFiles.push(jsonPath);
  }

  if (formats.includes('markdown') || formats.includes('md')) {
    const mdContent = generateMarkdownReport(issues, config, tokenStats);
    const mdPath = path.join(outputDir, `token-drift-report-${timestamp}.md`);
    fs.writeFileSync(mdPath, mdContent, 'utf-8');
    writtenFiles.push(mdPath);
  }

  if (formats.includes('html')) {
    const htmlContent = generateHTMLReport(issues, config, tokenStats);
    const htmlPath = path.join(outputDir, `token-drift-report-${timestamp}.html`);
    fs.writeFileSync(htmlPath, htmlContent, 'utf-8');
    writtenFiles.push(htmlPath);
  }

  return writtenFiles;
}
