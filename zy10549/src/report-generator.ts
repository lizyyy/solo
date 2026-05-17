import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { ScanResult, OrphanItem } from './types';

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = path.resolve(outputDir);
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  generate(result: ScanResult, formats: ('terminal' | 'json' | 'html')[]): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (formats.includes('terminal')) {
      this.printTerminalSummary(result);
    }

    if (formats.includes('json')) {
      this.writeJSONReport(result, timestamp);
    }

    if (formats.includes('html')) {
      this.writeHTMLReport(result, timestamp);
    }
  }

  private printTerminalSummary(result: ScanResult): void {
    console.log('\n' + chalk.bold.blue('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.blue('                前端路由孤儿检测报告'));
    console.log(chalk.bold.blue('═══════════════════════════════════════════════════════════════\n'));

    console.log(chalk.bold('📊 扫描概要\n'));
    
    const summaryData = [
      [chalk.cyan('总路由数'), result.summary.totalRoutes.toString()],
      [chalk.cyan('总页面数'), result.summary.totalPages.toString()],
      [chalk.cyan('扫描耗时'), `${result.metadata.durationMs}ms`],
      [chalk.cyan('扫描时间'), new Date(result.metadata.scanTime).toLocaleString('zh-CN')]
    ];

    console.log(table(summaryData, {
      header: {
        alignment: 'center',
        content: '扫描统计'
      }
    }));

    if (result.summary.orphanCount > 0) {
      console.log(chalk.bold('\n⚠️  发现的问题\n'));

      const issueCounts = [
        [chalk.red('路由无对应页面'), result.summary.routeWithoutPage.toString()],
        [chalk.yellow('页面无对应路由'), result.summary.pageWithoutRoute.toString()],
        [chalk.magenta('无效路由配置'), result.summary.invalidRoute.toString()]
      ];

      console.log(table(issueCounts, {
        header: {
          alignment: 'center',
          content: '问题分类统计'
        }
      }));

      this.printOrphanDetails(result.orphans);
    } else {
      console.log(chalk.green('\n✅ 太棒了！未发现路由孤儿问题！\n'));
    }

    console.log(chalk.bold('\n📁 输出目录:'));
    console.log(`   ${this.outputDir}\n`);
  }

  private printOrphanDetails(orphans: OrphanItem[]): void {
    console.log(chalk.bold('\n📋 详细问题列表\n'));

    for (let i = 0; i < orphans.length; i++) {
      const orphan = orphans[i];
      const severityColor = orphan.severity === 'error' ? chalk.red : 
                             orphan.severity === 'warning' ? chalk.yellow : chalk.blue;

      console.log(`${severityColor(`[${i + 1}] ${orphan.type}`)}`);
      console.log(`    ${chalk.bold('原因:')} ${orphan.reason}`);

      if (orphan.routePath) {
        console.log(`    ${chalk.bold('路由路径:')} ${orphan.routePath}`);
      }
      if (orphan.routeName) {
        console.log(`    ${chalk.bold('路由名称:')} ${orphan.routeName}`);
      }
      if (orphan.componentPath) {
        console.log(`    ${chalk.bold('组件路径:')} ${orphan.componentPath}`);
      }
      if (orphan.filePath) {
        console.log(`    ${chalk.bold('文件路径:')} ${orphan.filePath}`);
      }
      if (orphan.location) {
        console.log(`    ${chalk.bold('位置:')} ${orphan.location.file}`);
        if (orphan.location.line) {
          console.log(`    ${chalk.bold('行号:')} ${orphan.location.line}`);
        }
        if (orphan.location.snippet) {
          console.log(`    ${chalk.bold('代码片段:')} ${orphan.location.snippet}`);
        }
      }
      console.log('');
    }
  }

  private writeJSONReport(result: ScanResult, timestamp: string): void {
    const fileName = `route-orphan-report-${timestamp}.json`;
    const filePath = path.join(this.outputDir, fileName);

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');

    const latestPath = path.join(this.outputDir, 'latest-report.json');
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.copyFileSync(filePath, latestPath);
  }

  private writeHTMLReport(result: ScanResult, timestamp: string): void {
    const fileName = `route-orphan-report-${timestamp}.html`;
    const filePath = path.join(this.outputDir, fileName);

    const html = this.generateHTML(result);
    fs.writeFileSync(filePath, html, 'utf-8');

    const latestPath = path.join(this.outputDir, 'latest-report.html');
    if (fs.existsSync(latestPath)) {
      fs.unlinkSync(latestPath);
    }
    fs.copyFileSync(filePath, latestPath);
  }

  private generateHTML(result: ScanResult): string {
    const orphanItemsHTML = result.orphans.map((orphan, index) => {
      const severityClass = orphan.severity === 'error' ? 'error' : 
                            orphan.severity === 'warning' ? 'warning' : 'info';
      
      return `
        <div class="orphan-item ${severityClass}">
          <div class="orphan-header">
            <span class="orphan-number">#${index + 1}</span>
            <span class="orphan-type">${orphan.type}</span>
            <span class="orphan-severity">${orphan.severity.toUpperCase()}</span>
          </div>
          <div class="orphan-body">
            <p class="reason"><strong>原因：</strong>${this.escapeHTML(orphan.reason)}</p>
            ${orphan.routePath ? `<p><strong>路由路径：</strong><code>${this.escapeHTML(orphan.routePath)}</code></p>` : ''}
            ${orphan.routeName ? `<p><strong>路由名称：</strong>${this.escapeHTML(orphan.routeName)}</p>` : ''}
            ${orphan.componentPath ? `<p><strong>组件路径：</strong><code>${this.escapeHTML(orphan.componentPath)}</code></p>` : ''}
            ${orphan.filePath ? `<p><strong>文件路径：</strong><code>${this.escapeHTML(orphan.filePath)}</code></p>` : ''}
            ${orphan.location ? `
              <p><strong>位置：</strong><code>${this.escapeHTML(orphan.location.file)}</code></p>
              ${orphan.location.line ? `<p><strong>行号：</strong>${orphan.location.line}</p>` : ''}
              ${orphan.location.snippet ? `<p><strong>代码片段：</strong><code class="snippet">${this.escapeHTML(orphan.location.snippet)}</code></p>` : ''}
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>前端路由孤儿检测报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
    }
    .summary-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    }
    .summary-section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #2c3e50;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }
    .stat-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      border-left: 4px solid #667eea;
    }
    .stat-card.error {
      border-left-color: #e74c3c;
    }
    .stat-card.warning {
      border-left-color: #f39c12;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-card.error .stat-value { color: #e74c3c; }
    .stat-card.warning .stat-value { color: #f39c12; }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .issues-section {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    }
    .issues-section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #2c3e50;
      border-bottom: 2px solid #e74c3c;
      padding-bottom: 10px;
    }
    .no-issues {
      text-align: center;
      padding: 40px;
      color: #27ae60;
      font-size: 18px;
    }
    .no-issues .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .orphan-item {
      border-radius: 8px;
      margin-bottom: 15px;
      overflow: hidden;
    }
    .orphan-item.error { border: 1px solid #fecdd3; }
    .orphan-item.warning { border: 1px solid #fef3c7; }
    .orphan-item.info { border: 1px solid #dbeafe; }
    .orphan-header {
      padding: 12px 16px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .orphan-item.error .orphan-header { background: #fecdd3; }
    .orphan-item.warning .orphan-header { background: #fef3c7; }
    .orphan-item.info .orphan-header { background: #dbeafe; }
    .orphan-number {
      font-weight: bold;
      font-size: 14px;
    }
    .orphan-type {
      font-weight: 600;
      flex: 1;
    }
    .orphan-severity {
      font-size: 12px;
      font-weight: bold;
      padding: 2px 8px;
      border-radius: 4px;
      background: rgba(0,0,0,0.1);
    }
    .orphan-body {
      padding: 16px;
      background: white;
    }
    .orphan-body p {
      margin-bottom: 8px;
    }
    .orphan-body code {
      background: #f4f4f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
    }
    .orphan-body code.snippet {
      display: block;
      padding: 10px;
      margin-top: 5px;
      overflow-x: auto;
    }
    .reason {
      font-size: 15px;
      color: #374151;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #666;
      font-size: 14px;
    }
    .metadata {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-top: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
    }
    .metadata h3 {
      font-size: 16px;
      margin-bottom: 15px;
      color: #2c3e50;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      font-size: 14px;
    }
    .metadata-item {
      display: flex;
      justify-content: space-between;
    }
    .metadata-label {
      color: #666;
    }
    .metadata-value {
      font-family: 'Monaco', monospace;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 前端路由孤儿检测报告</h1>
      <p>检测时间：${new Date(result.metadata.scanTime).toLocaleString('zh-CN')}</p>
    </div>

    <div class="summary-section">
      <h2>📊 扫描概要</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${result.summary.totalRoutes}</div>
          <div class="stat-label">总路由数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${result.summary.totalPages}</div>
          <div class="stat-label">总页面数</div>
        </div>
        <div class="stat-card ${result.summary.orphanCount > 0 ? 'error' : ''}">
          <div class="stat-value">${result.summary.orphanCount}</div>
          <div class="stat-label">问题总数</div>
        </div>
      </div>
      ${result.summary.orphanCount > 0 ? `
      <div class="stats-grid" style="margin-top: 20px;">
        <div class="stat-card error">
          <div class="stat-value">${result.summary.routeWithoutPage}</div>
          <div class="stat-label">路由无对应页面</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${result.summary.pageWithoutRoute}</div>
          <div class="stat-label">页面无对应路由</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${result.summary.invalidRoute}</div>
          <div class="stat-label">无效路由配置</div>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="issues-section">
      <h2>⚠️ 问题详情</h2>
      ${result.orphans.length === 0 ? `
        <div class="no-issues">
          <div class="icon">✅</div>
          <div>太棒了！未发现路由孤儿问题！</div>
        </div>
      ` : orphanItemsHTML}
    </div>

    <div class="metadata">
      <h3>📁 扫描元数据</h3>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">源码目录</span>
          <span class="metadata-value">${this.escapeHTML(result.metadata.sourceDir)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">输出目录</span>
          <span class="metadata-value">${this.escapeHTML(result.metadata.outputDir)}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">扫描耗时</span>
          <span class="metadata-value">${result.metadata.durationMs}ms</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">扫描时间</span>
          <span class="metadata-value">${new Date(result.metadata.scanTime).toLocaleString('zh-CN')}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>路由孤儿检测工具 v1.0.0</p>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}