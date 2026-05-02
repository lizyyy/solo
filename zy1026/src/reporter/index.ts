import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { RunResult, CheckResult, FileCheckResult, LinkType } from '../types';
import { ensureDir } from '../utils';

export class Reporter {
  private result: RunResult;

  constructor(result: RunResult) {
    this.result = result;
  }

  printTerminalSummary(): void {
    const { files, links, issues } = this.result;

    console.log('\n' + chalk.bold.underline('📋 DocGuard 检查报告') + '\n');

    console.log(chalk.bold('📁 文件统计:'));
    console.log(`  总计: ${files.total} 个文件`);
    console.log(`  已检查: ${files.checked} 个文件`);
    console.log(`  有问题: ${chalk.red(files.withIssues)} 个文件\n`);

    console.log(chalk.bold('🔗 链接统计:'));
    console.log(`  总计: ${links.total} 个链接`);
    console.log(`  图片: ${links.images} 个`);
    console.log(`  本地链接: ${links.locals} 个`);
    console.log(`  锚点: ${links.anchors} 个`);
    console.log(`  外链: ${links.externals} 个\n`);

    console.log(chalk.bold('❌ 问题统计:'));
    if (issues.total === 0) {
      console.log(chalk.green('  ✅ 未发现任何问题!'));
    } else {
      console.log(`  总计: ${issues.total} 个问题`);
      if (issues.errors > 0) {
        console.log(`  ${chalk.red('错误')}: ${issues.errors} 个`);
      }
      if (issues.warnings > 0) {
        console.log(`  ${chalk.yellow('警告')}: ${issues.warnings} 个`);
      }
      if (issues.infos > 0) {
        console.log(`  ${chalk.blue('信息')}: ${issues.infos} 个`);
      }
      console.log('');
    }

    if (issues.total > 0) {
      this.printIssuesDetails();
    }

    console.log('\n' + chalk.gray(`检查时间: ${this.result.timestamp}`));
  }

  private printIssuesDetails(): void {
    const filesWithIssues = this.result.results.filter(r => r.issues.length > 0);

    for (const fileResult of filesWithIssues) {
      const relativePath = path.relative(process.cwd(), fileResult.filePath);
      const issueCount = fileResult.issues.length;
      
      console.log(chalk.bold(`📄 ${relativePath}`) + chalk.gray(` (${issueCount} 个问题)`));

      for (const issue of fileResult.issues) {
        const typeIcon = this.getTypeIcon(issue.type);
        const severityColor = this.getSeverityColor(issue.severity);
        const lineInfo = issue.line ? `:${issue.line}` : '';
        
        console.log(
          `  ${typeIcon} ${severityColor(issue.severity.toUpperCase())} ` +
          chalk.gray(`${relativePath}${lineInfo}`)
        );
        console.log(`     ${issue.message}`);
        console.log(`     原始内容: ${chalk.cyan(issue.raw)}`);
        
        if (issue.resolved) {
          console.log(`     解析路径: ${chalk.gray(issue.resolved)}`);
        }
        console.log('');
      }
    }
  }

  private getTypeIcon(type: LinkType): string {
    switch (type) {
      case 'image': return '🖼️';
      case 'local': return '📁';
      case 'anchor': return '🔗';
      case 'external': return '🌐';
      default: return '❓';
    }
  }

  private getSeverityColor(severity: string): typeof chalk.red {
    switch (severity) {
      case 'error': return chalk.red;
      case 'warning': return chalk.yellow;
      case 'info': return chalk.blue;
      default: return chalk.gray;
    }
  }

  generateMarkdownReport(): string {
    const { files, links, issues, timestamp } = this.result;

    let md = `# DocGuard 检查报告\n\n`;
    md += `> 生成时间: ${timestamp}\n\n`;

    md += `## 📊 概览\n\n`;
    md += `| 类别 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 总文件数 | ${files.total} |\n`;
    md += `| 已检查文件 | ${files.checked} |\n`;
    md += `| 有问题文件 | ${files.withIssues} |\n`;
    md += `| 总链接数 | ${links.total} |\n`;
    md += `| 总问题数 | ${issues.total} |\n\n`;

    md += `## 🔗 链接类型统计\n\n`;
    md += `| 类型 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 🖼️ 图片 | ${links.images} |\n`;
    md += `| 📁 本地链接 | ${links.locals} |\n`;
    md += `| 🔗 锚点 | ${links.anchors} |\n`;
    md += `| 🌐 外链 | ${links.externals} |\n\n`;

    md += `## ⚠️ 问题统计\n\n`;
    md += `| 严重程度 | 数量 |\n`;
    md += `|----------|------|\n`;
    md += `| 🔴 错误 | ${issues.errors} |\n`;
    md += `| 🟡 警告 | ${issues.warnings} |\n`;
    md += `| 🔵 信息 | ${issues.infos} |\n\n`;

    const filesWithIssues = this.result.results.filter(r => r.issues.length > 0);
    if (filesWithIssues.length > 0) {
      md += `## 📋 详细问题\n\n`;

      for (const fileResult of filesWithIssues) {
        const relativePath = path.relative(process.cwd(), fileResult.filePath);
        md += `### 📄 ${relativePath}\n\n`;

        for (const issue of fileResult.issues) {
          const severityLabel = issue.severity === 'error' ? '🔴' : 
                                issue.severity === 'warning' ? '🟡' : '🔵';
          const typeLabel = this.getTypeIcon(issue.type);
          const lineInfo = issue.line ? ` (行 ${issue.line})` : '';

          md += `#### ${severityLabel} ${typeLabel} ${issue.severity.toUpperCase()}${lineInfo}\n\n`;
          md += `${issue.message}\n\n`;
          md += `\`\`\`\n${issue.raw}\n\`\`\`\n\n`;

          if (issue.resolved) {
            md += `**解析路径**: \`${issue.resolved}\`\n\n`;
          }
        }
      }
    } else {
      md += `## ✅ 全部通过\n\n`;
      md += `未发现任何问题！\n\n`;
    }

    md += `---\n\n`;
    md += `*由 DocGuard 生成*`;

    return md;
  }

  generateHtmlReport(): string {
    const { files, links, issues, timestamp } = this.result;
    const filesWithIssues = this.result.results.filter(r => r.issues.length > 0);

    const getSeverityClass = (severity: string) => {
      switch (severity) {
        case 'error': return 'severity-error';
        case 'warning': return 'severity-warning';
        case 'info': return 'severity-info';
        default: return '';
      }
    };

    const getTypeIcon = (type: LinkType) => {
      switch (type) {
        case 'image': return '🖼️';
        case 'local': return '📁';
        case 'anchor': return '🔗';
        case 'external': return '🌐';
        default: return '❓';
      }
    };

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocGuard 检查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f7fa;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .timestamp {
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
    }
    .stat-card .label {
      font-size: 14px;
      color: #64748b;
      margin-top: 5px;
    }
    .stat-card.error .value { color: #ef4444; }
    .stat-card.warning .value { color: #f59e0b; }
    .stat-card.success .value { color: #10b981; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    tr:hover {
      background: #f8fafc;
    }
    
    .issue-item {
      background: #f8fafc;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      border-left: 4px solid #e2e8f0;
    }
    .issue-item.severity-error { border-left-color: #ef4444; }
    .issue-item.severity-warning { border-left-color: #f59e0b; }
    .issue-item.severity-info { border-left-color: #3b82f6; }
    
    .issue-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .issue-severity {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 4px 8px;
      border-radius: 4px;
    }
    .issue-severity.error { background: #fee2e2; color: #dc2626; }
    .issue-severity.warning { background: #fef3c7; color: #d97706; }
    .issue-severity.info { background: #dbeafe; color: #2563eb; }
    
    .issue-location {
      color: #64748b;
      font-size: 14px;
    }
    .issue-message {
      margin-bottom: 10px;
    }
    .issue-code {
      background: #1e293b;
      color: #e2e8f0;
      padding: 10px 15px;
      border-radius: 4px;
      font-family: 'Fira Code', monospace;
      font-size: 14px;
      overflow-x: auto;
    }
    .issue-resolved {
      color: #64748b;
      font-size: 13px;
      margin-top: 8px;
    }
    
    .file-section {
      margin-bottom: 30px;
    }
    .file-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px 15px;
      background: #f1f5f9;
      border-radius: 6px;
    }
    .file-name {
      font-weight: 600;
      font-size: 16px;
    }
    .file-issue-count {
      background: #ef4444;
      color: white;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
    }
    
    .all-clear {
      text-align: center;
      padding: 60px 20px;
      color: #10b981;
    }
    .all-clear .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .all-clear .text {
      font-size: 24px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 DocGuard 检查报告</h1>
      <div class="timestamp">生成时间: ${timestamp}</div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2 class="section-title">📊 概览</h2>
        <div class="grid">
          <div class="stat-card">
            <div class="value">${files.total}</div>
            <div class="label">总文件数</div>
          </div>
          <div class="stat-card">
            <div class="value">${links.total}</div>
            <div class="label">总链接数</div>
          </div>
          <div class="stat-card ${issues.errors > 0 ? 'error' : issues.warnings > 0 ? 'warning' : 'success'}">
            <div class="value">${issues.total}</div>
            <div class="label">问题总数</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2 class="section-title">🔗 链接类型统计</h2>
        <table>
          <thead>
            <tr><th>类型</th><th>数量</th></tr>
          </thead>
          <tbody>
            <tr><td>🖼️ 图片</td><td>${links.images}</td></tr>
            <tr><td>📁 本地链接</td><td>${links.locals}</td></tr>
            <tr><td>🔗 锚点</td><td>${links.anchors}</td></tr>
            <tr><td>🌐 外链</td><td>${links.externals}</td></tr>
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2 class="section-title">⚠️ 问题统计</h2>
        <table>
          <thead>
            <tr><th>严重程度</th><th>数量</th></tr>
          </thead>
          <tbody>
            <tr><td>🔴 错误</td><td>${issues.errors}</td></tr>
            <tr><td>🟡 警告</td><td>${issues.warnings}</td></tr>
            <tr><td>🔵 信息</td><td>${issues.infos}</td></tr>
          </tbody>
        </table>
      </div>
      
      ${filesWithIssues.length > 0 ? `
      <div class="section">
        <h2 class="section-title">📋 详细问题</h2>
        ${filesWithIssues.map(fileResult => `
          <div class="file-section">
            <div class="file-header">
              <span class="file-name">📄 ${path.relative(process.cwd(), fileResult.filePath)}</span>
              <span class="file-issue-count">${fileResult.issues.length} 个问题</span>
            </div>
            ${fileResult.issues.map(issue => `
              <div class="issue-item ${getSeverityClass(issue.severity)}">
                <div class="issue-header">
                  <span class="issue-severity ${issue.severity}">${issue.severity.toUpperCase()}</span>
                  <span>${getTypeIcon(issue.type)}</span>
                  ${issue.line ? `<span class="issue-location">行 ${issue.line}</span>` : ''}
                </div>
                <div class="issue-message">${issue.message}</div>
                <div class="issue-code">${this.escapeHtml(issue.raw)}</div>
                ${issue.resolved ? `<div class="issue-resolved">解析路径: ${this.escapeHtml(issue.resolved)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      ` : `
      <div class="section">
        <div class="all-clear">
          <div class="icon">✅</div>
          <div class="text">全部通过！未发现任何问题</div>
        </div>
      </div>
      `}
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  generateJsonReport(): string {
    return JSON.stringify(this.result, null, 2);
  }

  writeReports(): void {
    const { output } = this.result.config;

    if (output.markdown && output.markdownPath) {
      const markdownPath = path.resolve(process.cwd(), output.markdownPath);
      ensureDir(path.dirname(markdownPath));
      fs.writeFileSync(markdownPath, this.generateMarkdownReport(), 'utf-8');
      console.log(`Markdown 报告已写入: ${markdownPath}`);
    }

    if (output.html && output.htmlPath) {
      const htmlPath = path.resolve(process.cwd(), output.htmlPath);
      ensureDir(path.dirname(htmlPath));
      fs.writeFileSync(htmlPath, this.generateHtmlReport(), 'utf-8');
      console.log(`HTML 报告已写入: ${htmlPath}`);
    }

    if (output.json && output.jsonPath) {
      const jsonPath = path.resolve(process.cwd(), output.jsonPath);
      ensureDir(path.dirname(jsonPath));
      fs.writeFileSync(jsonPath, this.generateJsonReport(), 'utf-8');
      console.log(`JSON 结果已写入: ${jsonPath}`);
    }
  }
}
