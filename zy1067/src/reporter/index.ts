import * as path from 'path';
import * as fs from 'fs-extra';
import { ScanResult, ReporterOptions, Severity, AccessibilityIssue, FocusPathItem, RouteResult } from '../types';
import { getTimestampFilename, formatDate, truncateText } from '../utils';

const severityColors: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#65a30d',
};

const severityLabels: Record<Severity, string> = {
  critical: '严重',
  high: '高',
  medium: '中',
  low: '低',
};

const severityEmojis: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

export class Reporter {
  private result: ScanResult;
  private options: ReporterOptions;

  constructor(result: ScanResult, options: ReporterOptions) {
    this.result = result;
    this.options = options;
  }

  async generate(): Promise<string> {
    switch (this.options.format) {
      case 'json':
        return this.generateJSON();
      case 'markdown':
        return this.generateMarkdown();
      case 'html':
        return this.generateHTML();
      default:
        return this.generateMarkdown();
    }
  }

  private generateJSON(): string {
    const output = {
      ...this.result,
      generatedAt: new Date().toISOString(),
      options: this.options,
    };
    return JSON.stringify(output, null, 2);
  }

  private generateMarkdown(): string {
    const lines: string[] = [];

    lines.push(`# 键盘可访问性巡检报告`);
    lines.push('');
    lines.push(`**生成时间**: ${formatDate(new Date(this.result.timestamp))}`);
    lines.push(`**扫描 ID**: ${this.result.id}`);
    lines.push('');

    lines.push('## 📊 概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 总页面数 | ${this.result.summary.totalPages} |`);
    lines.push(`| 成功扫描 | ${this.result.summary.scannedPages} |`);
    lines.push(`| 扫描失败 | ${this.result.summary.failedPages} |`);
    lines.push(`| 问题总数 | ${this.result.summary.totalIssues} |`);
    lines.push(`| 扫描耗时 | ${(this.result.summary.duration / 1000).toFixed(2)} 秒 |`);
    lines.push('');

    lines.push('### 问题按严重程度分布');
    lines.push('');
    lines.push('| 严重程度 | 数量 |');
    lines.push('|----------|------|');
    lines.push(`| 🔴 严重 | ${this.result.summary.issuesBySeverity.critical} |`);
    lines.push(`| 🟠 高 | ${this.result.summary.issuesBySeverity.high} |`);
    lines.push(`| 🟡 中 | ${this.result.summary.issuesBySeverity.medium} |`);
    lines.push(`| 🟢 低 | ${this.result.summary.issuesBySeverity.low} |`);
    lines.push('');

    if (Object.keys(this.result.summary.issuesByType).length > 0) {
      lines.push('### 问题按类型分布');
      lines.push('');
      lines.push('| 问题类型 | 数量 |');
      lines.push('|----------|------|');
      for (const [type, count] of Object.entries(this.result.summary.issuesByType)) {
        lines.push(`| ${type} | ${count} |`);
      }
      lines.push('');
    }

    if (this.result.errors.length > 0) {
      lines.push('## ⚠️ 配置/扫描错误');
      lines.push('');
      for (const error of this.result.errors) {
        lines.push(`- **${error.type}**: ${error.message}`);
        if (error.details) {
          lines.push(`  - 详情: ${error.details}`);
        }
        if (error.routeId) {
          lines.push(`  - 路由: ${error.routeId}`);
        }
        if (error.field) {
          lines.push(`  - 字段: ${error.field}`);
        }
        lines.push('');
      }
    }

    lines.push('## 📄 页面详情');
    lines.push('');

    for (const routeResult of this.result.routes) {
      lines.push(`### ${routeResult.routeName}`);
      lines.push('');
      lines.push(`- **URL**: ${routeResult.url}`);
      lines.push(`- **状态**: ${routeResult.status === 'success' ? '✅ 成功' : '❌ 失败'}`);
      lines.push(`- **耗时**: ${(routeResult.duration / 1000).toFixed(2)} 秒`);
      
      if (routeResult.screenshot) {
        lines.push(`- **截图**: ${routeResult.screenshot}`);
      }
      
      lines.push('');

      if (routeResult.error) {
        lines.push('#### ❌ 错误信息');
        lines.push('');
        lines.push(`- **类型**: ${routeResult.error.type}`);
        lines.push(`- **消息**: ${routeResult.error.message}`);
        if (routeResult.error.details) {
          lines.push(`- **详情**: ${routeResult.error.details}`);
        }
        lines.push('');
        continue;
      }

      lines.push(`#### 📋 焦点路径 (${routeResult.focusPath.length} 个元素)`);
      lines.push('');
      
      if (routeResult.focusPath.length > 0) {
        lines.push('| 索引 | 元素 | 可见性 | 焦点样式 | TabIndex |');
        lines.push('|------|------|--------|----------|----------|');
        
        for (const item of routeResult.focusPath) {
          const visible = item.isVisible ? '✅ 可见' : '❌ 不可见';
          const focusStyle = (item.focusVisible || item.hasVisibleOutline) ? '✅ 可见' : '❌ 不可见';
          const tabIndex = item.tabIndexValue !== null ? String(item.tabIndexValue) : '-';
          
          let elementDisplay = item.elementInfo.tagName;
          if (item.elementInfo.id) {
            elementDisplay += `#${item.elementInfo.id}`;
          }
          if (item.elementInfo.accessibleName) {
            elementDisplay += ` "${truncateText(item.elementInfo.accessibleName, 30)}"`;
          }
          
          lines.push(`| ${item.index} | ${elementDisplay} | ${visible} | ${focusStyle} | ${tabIndex} |`);
        }
      } else {
        lines.push('未检测到可聚焦元素');
      }
      lines.push('');

      if (routeResult.issues.length > 0) {
        lines.push(`#### ⚠️ 发现的问题 (${routeResult.issues.length} 个)`);
        lines.push('');

        const sortedIssues = [...routeResult.issues].sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        });

        for (let i = 0; i < sortedIssues.length; i++) {
          const issue = sortedIssues[i];
          const emoji = severityEmojis[issue.severity];
          const label = severityLabels[issue.severity];

          lines.push(`##### ${emoji} ${issue.title} (${label})`);
          lines.push('');
          lines.push(`- **类型**: ${issue.type}`);
          lines.push(`- **严重程度**: ${label}`);
          lines.push('');
          lines.push('**描述**:');
          lines.push(`> ${issue.description}`);
          lines.push('');
          lines.push('**建议**:');
          lines.push(`> ${issue.recommendation}`);
          lines.push('');
          lines.push('**元素信息**:');
          lines.push(`- 选择器: \`${issue.element.selector}\``);
          lines.push(`- 标签: ${issue.element.tagName}`);
          if (issue.element.id) {
            lines.push(`- ID: ${issue.element.id}`);
          }
          if (issue.element.accessibleName) {
            lines.push(`- 可访问名称: ${issue.element.accessibleName}`);
          }
          if (issue.element.domSnippet) {
            lines.push('');
            lines.push('**DOM 片段**:');
            lines.push('```html');
            lines.push(issue.element.domSnippet);
            lines.push('```');
          }
          lines.push('');
        }
      } else {
        lines.push('#### ✅ 未发现可访问性问题');
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    lines.push('## 📚 检查器说明');
    lines.push('');
    lines.push('| 检查器 | 说明 |');
    lines.push('|--------|------|');
    lines.push('| focus-order | 检查焦点顺序是否逻辑合理 |');
    lines.push('| focus-visibility | 检查焦点样式是否可见 |');
    lines.push('| skip-link | 检查是否存在跳过导航链接 |');
    lines.push('| form-label | 检查表单控件是否有正确的标签 |');
    lines.push('| button-name | 检查按钮是否有可访问名称 |');
    lines.push('| modal-trap | 检查模态框的焦点管理 |');
    lines.push('');

    return lines.join('\n');
  }

  private generateHTML(): string {
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>键盘可访问性巡检报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
    .header .meta {
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
    }
    h2 {
      font-size: 24px;
      margin: 30px 0 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
      color: #2d3748;
    }
    h3 {
      font-size: 20px;
      margin: 25px 0 15px;
      color: #4a5568;
    }
    h4 {
      font-size: 18px;
      margin: 20px 0 12px;
      color: #4a5568;
    }
    h5 {
      font-size: 16px;
      margin: 15px 0 10px;
      color: #4a5568;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    table th,
    table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    table th {
      background: #f7fafc;
      font-weight: 600;
      color: #4a5568;
    }
    table tr:hover {
      background: #f7fafc;
    }
    .severity-critical { background: #fef2f2; border-left: 4px solid ${severityColors.critical}; }
    .severity-high { background: #fff7ed; border-left: 4px solid ${severityColors.high}; }
    .severity-medium { background: #fefce8; border-left: 4px solid ${severityColors.medium}; }
    .severity-low { background: #f7fee7; border-left: 4px solid ${severityColors.low}; }
    .issue-card {
      padding: 20px;
      margin: 15px 0;
      border-radius: 6px;
    }
    .issue-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .issue-meta {
      font-size: 14px;
      color: #718096;
      margin-bottom: 15px;
    }
    .issue-description,
    .issue-recommendation {
      margin: 10px 0;
      padding: 10px 15px;
      background: rgba(255,255,255,0.7);
      border-radius: 4px;
    }
    .issue-description strong,
    .issue-recommendation strong {
      display: block;
      margin-bottom: 5px;
      color: #2d3748;
    }
    .code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      background: #f7fafc;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 14px;
    }
    pre {
      background: #2d3748;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 14px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .stat-card .label {
      font-size: 14px;
      opacity: 0.9;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 8px;
    }
    .badge-critical { background: ${severityColors.critical}; color: white; }
    .badge-high { background: ${severityColors.high}; color: white; }
    .badge-medium { background: ${severityColors.medium}; color: white; }
    .badge-low { background: ${severityColors.low}; color: white; }
    .success-badge {
      display: inline-block;
      background: #48bb78;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .error-badge {
      display: inline-block;
      background: #e53e3e;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .divider {
      height: 1px;
      background: #e2e8f0;
      margin: 30px 0;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 15px;
      border-radius: 6px;
      margin: 15px 0;
    }
    .error-box h4 {
      color: #c53030;
      margin-top: 0;
    }
    .focus-path-table {
      font-size: 14px;
    }
    .focus-path-table .visible-yes { color: #48bb78; }
    .focus-path-table .visible-no { color: #e53e3e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 键盘可访问性巡检报告</h1>
      <div class="meta">
        <p>生成时间: ${formatDate(new Date(this.result.timestamp))}</p>
        <p>扫描 ID: ${this.result.id}</p>
      </div>
    </div>

    <div class="content">
      <h2>📊 扫描概览</h2>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${this.result.summary.totalPages}</div>
          <div class="label">总页面数</div>
        </div>
        <div class="stat-card">
          <div class="value">${this.result.summary.scannedPages}</div>
          <div class="label">成功扫描</div>
        </div>
        <div class="stat-card">
          <div class="value">${this.result.summary.totalIssues}</div>
          <div class="label">发现问题</div>
        </div>
        <div class="stat-card">
          <div class="value">${(this.result.summary.duration / 1000).toFixed(1)}s</div>
          <div class="label">扫描耗时</div>
        </div>
      </div>

      <h3>问题按严重程度分布</h3>
      <table>
        <thead>
          <tr>
            <th>严重程度</th>
            <th>数量</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="severity-badge badge-critical">严重</span></td>
            <td>${this.result.summary.issuesBySeverity.critical}</td>
            <td>必须立即修复的阻断性问题</td>
          </tr>
          <tr>
            <td><span class="severity-badge badge-high">高</span></td>
            <td>${this.result.summary.issuesBySeverity.high}</td>
            <td>应在验收前修复的重要问题</td>
          </tr>
          <tr>
            <td><span class="severity-badge badge-medium">中</span></td>
            <td>${this.result.summary.issuesBySeverity.medium}</td>
            <td>建议修复的体验问题</td>
          </tr>
          <tr>
            <td><span class="severity-badge badge-low">低</span></td>
            <td>${this.result.summary.issuesBySeverity.low}</td>
            <td>可优化的小问题</td>
          </tr>
        </tbody>
      </table>

      ${this.result.errors.length > 0 ? `
        <h2>⚠️ 配置/扫描错误</h2>
        ${this.result.errors.map(error => `
          <div class="error-box">
            <h4>${error.type === 'config-error' ? '配置错误' : error.type === 'validation-error' ? '验证错误' : '页面错误'}</h4>
            <p><strong>消息:</strong> ${error.message}</p>
            ${error.details ? `<p><strong>详情:</strong> ${error.details}</p>` : ''}
            ${error.routeId ? `<p><strong>路由:</strong> ${error.routeId}</p>` : ''}
            ${error.field ? `<p><strong>字段:</strong> <span class="code">${error.field}</span></p>` : ''}
          </div>
        `).join('')}
      ` : ''}

      <h2>📄 页面详情</h2>
      
      ${this.result.routes.map(route => `
        <div class="divider"></div>
        
        <h3>
          ${route.status === 'success' ? '✅' : '❌'} ${route.routeName}
          ${route.status === 'success' ? 
            '<span class="success-badge">成功</span>' : 
            '<span class="error-badge">失败</span>'}
        </h3>
        
        <p><strong>URL:</strong> ${route.url}</p>
        <p><strong>耗时:</strong> ${(route.duration / 1000).toFixed(2)} 秒</p>
        ${route.screenshot ? `<p><strong>截图:</strong> <code>${route.screenshot}</code></p>` : ''}
        
        ${route.error ? `
          <div class="error-box">
            <h4>扫描错误</h4>
            <p><strong>类型:</strong> ${route.error.type}</p>
            <p><strong>消息:</strong> ${route.error.message}</p>
            ${route.error.details ? `<p><strong>详情:</strong> ${route.error.details}</p>` : ''}
          </div>
        ` : ''}
        
        ${!route.error && route.focusPath.length > 0 ? `
          <h4>📋 焦点路径 (${route.focusPath.length} 个元素)</h4>
          <table class="focus-path-table">
            <thead>
              <tr>
                <th>索引</th>
                <th>元素</th>
                <th>可见性</th>
                <th>焦点样式</th>
                <th>TabIndex</th>
              </tr>
            </thead>
            <tbody>
              ${route.focusPath.map(item => `
                <tr>
                  <td>${item.index}</td>
                  <td>
                    <span class="code">${item.elementInfo.tagName}${item.elementInfo.id ? '#' + item.elementInfo.id : ''}</span>
                    ${item.elementInfo.accessibleName ? `<br><small>"${truncateText(item.elementInfo.accessibleName, 40)}"</small>` : ''}
                  </td>
                  <td class="${item.isVisible ? 'visible-yes' : 'visible-no'}">
                    ${item.isVisible ? '✅ 可见' : '❌ 不可见'}
                  </td>
                  <td class="${(item.focusVisible || item.hasVisibleOutline) ? 'visible-yes' : 'visible-no'}">
                    ${(item.focusVisible || item.hasVisibleOutline) ? '✅ 可见' : '❌ 不可见'}
                  </td>
                  <td>${item.tabIndexValue !== null ? item.tabIndexValue : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
        
        ${route.issues.length > 0 ? `
          <h4>⚠️ 发现的问题 (${route.issues.length} 个)</h4>
          ${route.issues
            .sort((a, b) => {
              const order = { critical: 0, high: 1, medium: 2, low: 3 };
              return order[a.severity] - order[b.severity];
            })
            .map(issue => `
              <div class="issue-card severity-${issue.severity}">
                <div class="issue-title">
                  ${severityEmojis[issue.severity]} ${issue.title}
                  <span class="severity-badge badge-${issue.severity}">${severityLabels[issue.severity]}</span>
                </div>
                <div class="issue-meta">
                  类型: <span class="code">${issue.type}</span>
                </div>
                
                <div class="issue-description">
                  <strong>📝 描述:</strong>
                  ${issue.description}
                </div>
                
                <div class="issue-recommendation">
                  <strong>💡 建议:</strong>
                  ${issue.recommendation}
                </div>
                
                <p>
                  <strong>元素选择器:</strong>
                  <span class="code">${issue.element.selector}</span>
                </p>
                
                ${issue.element.domSnippet ? `
                  <details>
                    <summary style="cursor: pointer; color: #667eea;">查看 DOM 片段</summary>
                    <pre>${this.escapeHtml(issue.element.domSnippet)}</pre>
                  </details>
                ` : ''}
              </div>
            `).join('')}
        ` : `
          ${!route.error ? `
            <div style="padding: 20px; background: #f7fee7; border-radius: 6px; text-align: center; margin: 15px 0;">
              ✅ 未发现可访问性问题
            </div>
          ` : ''}
        `}
      `).join('')}

      <div class="divider"></div>
      
      <h2>📚 检查器说明</h2>
      <table>
        <thead>
          <tr>
            <th>检查器名称</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>focus-order</code></td>
            <td>检查键盘焦点顺序是否逻辑合理，与 DOM 顺序一致，检测正 tabindex 和不可见元素获取焦点等问题</td>
          </tr>
          <tr>
            <td><code>focus-visibility</code></td>
            <td>检查焦点样式是否可见，检测 outline: none 但无替代样式的问题</td>
          </tr>
          <tr>
            <td><code>skip-link</code></td>
            <td>检查是否存在跳过导航的链接，帮助键盘用户快速到达主要内容</td>
          </tr>
          <tr>
            <td><code>form-label</code></td>
            <td>检查表单控件是否有正确的标签关联 (label / aria-label / aria-labelledby)</td>
          </tr>
          <tr>
            <td><code>button-name</code></td>
            <td>检查按钮是否有可访问名称，确保图标按钮等能被屏幕阅读器正确识别</td>
          </tr>
          <tr>
            <td><code>modal-trap</code></td>
            <td>检查模态框的焦点管理，包括 role="dialog"、aria-modal、关闭按钮等</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  private escapeHtml(text: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (match) => htmlEntities[match] || match);
  }

  async save(outputPath?: string): Promise<string> {
    const content = await this.generate();
    
    const timestamp = getTimestampFilename();
    let defaultFilename: string;
    
    switch (this.options.format) {
      case 'json':
        defaultFilename = `report-${timestamp}.json`;
        break;
      case 'html':
        defaultFilename = `report-${timestamp}.html`;
        break;
      case 'markdown':
      default:
        defaultFilename = `report-${timestamp}.md`;
        break;
    }

    const output = outputPath || this.options.outputPath;
    let filepath: string;

    if (output) {
      const isDirectory = (await fs.pathExists(output)) && (await fs.stat(output)).isDirectory();
      if (isDirectory) {
        filepath = path.join(output, defaultFilename);
      } else {
        filepath = output;
      }
    } else {
      filepath = defaultFilename;
    }

    await fs.ensureDir(path.dirname(filepath));
    await fs.writeFile(filepath, content, 'utf-8');

    return filepath;
  }
}

export async function generateReport(
  result: ScanResult,
  options: ReporterOptions
): Promise<string> {
  const reporter = new Reporter(result, options);
  return reporter.save(options.outputPath);
}

export async function getLatestScanResult(dataDir: string): Promise<ScanResult | null> {
  const resultsDir = path.join(dataDir, 'results');
  
  if (!(await fs.pathExists(resultsDir))) {
    return null;
  }

  const files = await fs.readdir(resultsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();

  for (const file of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(resultsDir, file), 'utf-8');
      const result = JSON.parse(content) as ScanResult;
      if (result.version === '1.0' && result.routes) {
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}
