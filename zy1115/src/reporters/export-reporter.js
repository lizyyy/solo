const fs = require('fs');
const path = require('path');
const { IssueSeverity, IssueCategory } = require('../comparators/schema-comparator');

class ExportReporter {
  constructor() {
    this.severityOrder = [
      IssueSeverity.CRITICAL,
      IssueSeverity.HIGH,
      IssueSeverity.MEDIUM,
      IssueSeverity.LOW,
      IssueSeverity.INFO
    ];

    this.severityLabels = {
      [IssueSeverity.CRITICAL]: '严重 (Critical)',
      [IssueSeverity.HIGH]: '高危 (High)',
      [IssueSeverity.MEDIUM]: '中等 (Medium)',
      [IssueSeverity.LOW]: '低危 (Low)',
      [IssueSeverity.INFO]: '信息 (Info)'
    };

    this.categoryLabels = {
      [IssueCategory.DESTRUCTIVE_CHANGE]: '破坏性变更',
      [IssueCategory.MOCK_OUT_OF_SYNC]: 'Mock 未同步',
      [IssueCategory.NEW_FIELD_IN_CAPTURE]: '抓包新字段',
      [IssueCategory.DOCUMENTATION_MISSING]: '文档缺失',
      [IssueCategory.TYPE_MISMATCH]: '类型不匹配',
      [IssueCategory.ENUM_MISMATCH]: '枚举不匹配',
      [IssueCategory.NULLABLE_MISMATCH]: 'Nullable 不匹配',
      [IssueCategory.REQUIRED_MISMATCH]: '必填字段不匹配',
      [IssueCategory.PAGINATION_MISMATCH]: '分页不匹配',
      [IssueCategory.FORMAT_MISMATCH]: '格式不匹配',
      [IssueCategory.ENDPOINT_MISSING]: '端点缺失',
      [IssueCategory.ENDPOINT_EXTRA]: '额外端点'
    };
  }

  exportJson(comparisonResult, outputPath) {
    const jsonContent = JSON.stringify(comparisonResult, null, 2);
    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
    return true;
  }

  exportMarkdown(comparisonResult, outputPath) {
    const markdown = this.generateMarkdown(comparisonResult);
    fs.writeFileSync(outputPath, markdown, 'utf-8');
    return true;
  }

  exportHtml(comparisonResult, outputPath) {
    const html = this.generateHtml(comparisonResult);
    fs.writeFileSync(outputPath, html, 'utf-8');
    return true;
  }

  generateMarkdown(comparisonResult) {
    const { summary, issues, stats, dataSources } = comparisonResult;
    const lines = [];

    lines.push('# Schema Drift 检查报告');
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString()}`);
    lines.push('');

    lines.push('## 📊 概览');
    lines.push('');
    
    if (summary.hasIssues) {
      lines.push('### ⚠️ 发现问题');
      lines.push('');
      lines.push('| 级别 | 数量 |');
      lines.push('|------|------|');
      lines.push(`| 总计 | **${summary.totalIssues}** |`);
      if (summary.criticalCount > 0) lines.push(`| 🔴 严重 | ${summary.criticalCount} |`);
      if (summary.highCount > 0) lines.push(`| 🟠 高危 | ${summary.highCount} |`);
      if (summary.mediumCount > 0) lines.push(`| 🟡 中等 | ${summary.mediumCount} |`);
      if (summary.lowCount > 0) lines.push(`| 🔵 低危 | ${summary.lowCount} |`);
      if (summary.infoCount > 0) lines.push(`| ⚪ 信息 | ${summary.infoCount} |`);
      lines.push('');
      lines.push(`**受影响端点**: ${summary.affectedEndpoints} / ${summary.totalEndpoints}`);
    } else {
      lines.push('### ✅ 所有检查通过');
      lines.push('');
      lines.push('未发现任何 Schema 漂移问题。所有数据源的 Schema 保持一致。');
    }

    lines.push('');
    lines.push('---');
    lines.push('');

    if (dataSources && dataSources.length > 0) {
      lines.push('## 📁 检查的数据源');
      lines.push('');
      for (const source of dataSources) {
        lines.push(`- ${this.getDataSourceLabel(source)}`);
      }
      lines.push('');
    }

    if (summary.hasIssues && issues.length > 0) {
      lines.push('## 🔍 问题详情');
      lines.push('');

      const issuesBySeverity = this.groupBySeverity(issues);
      
      for (const severity of this.severityOrder) {
        const severityIssues = issuesBySeverity[severity] || [];
        if (severityIssues.length === 0) continue;

        const severityLabel = this.severityLabels[severity];
        const severityIcon = this.getSeverityIcon(severity);
        
        lines.push(`### ${severityIcon} ${severityLabel} (${severityIssues.length})`);
        lines.push('');

        const issuesByEndpoint = this.groupByEndpoint(severityIssues);
        
        for (const [endpointKey, endpointIssues] of Object.entries(issuesByEndpoint)) {
          const [method, path] = endpointKey.split(' ');
          lines.push(`#### 📍 ${method} \`${path}\``);
          lines.push('');
          
          for (const issue of endpointIssues) {
            lines.push(this.formatMarkdownIssue(issue));
            lines.push('');
          }
        }
      }

      lines.push('---');
      lines.push('');
      lines.push('## 💡 修复建议');
      lines.push('');

      const uniqueSuggestions = this.getUniqueSuggestions(issues);
      let index = 1;
      for (const suggestion of uniqueSuggestions) {
        lines.push(`${index}. ${suggestion}`);
        lines.push('');
        index++;
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('> 此报告由 Schema Drift Checker 生成');

    return lines.join('\n');
  }

  generateHtml(comparisonResult) {
    const { summary, issues, stats, dataSources } = comparisonResult;
    
    const htmlParts = [];
    
    htmlParts.push(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Schema Drift 检查报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f7fa;
    }
    .container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      padding: 40px;
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 15px; margin-bottom: 30px; }
    h2 { color: #34495e; margin-top: 40px; margin-bottom: 20px; border-left: 4px solid #3498db; padding-left: 15px; }
    h3 { color: #2c3e50; margin-top: 25px; margin-bottom: 15px; }
    h4 { color: #7f8c8d; margin-top: 20px; margin-bottom: 10px; }
    
    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .summary-card.success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }
    .summary-card h2 { color: white; border: none; padding: 0; margin: 0 0 20px 0; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-top: 20px;
    }
    .stat-item {
      background: rgba(255,255,255,0.2);
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: bold;
    }
    .stat-label {
      font-size: 12px;
      opacity: 0.9;
      margin-top: 5px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }
    tr:hover {
      background: #f8f9fa;
    }
    
    .issue {
      background: #f8f9fa;
      border-left: 4px solid #e74c3c;
      padding: 20px;
      margin: 15px 0;
      border-radius: 0 6px 6px 0;
    }
    .issue.critical { border-color: #c0392b; background: #fdf2f2; }
    .issue.high { border-color: #e74c3c; background: #fef5f5; }
    .issue.medium { border-color: #f39c12; background: #fffaf0; }
    .issue.low { border-color: #3498db; background: #ebf5fb; }
    .issue.info { border-color: #95a5a6; background: #f4f6f6; }
    
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .issue-category {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: #e9ecef;
      color: #495057;
    }
    .issue-severity {
      font-size: 12px;
      color: #6c757d;
    }
    .issue-message {
      font-size: 16px;
      margin-bottom: 10px;
      color: #2c3e50;
    }
    .issue-details {
      font-size: 14px;
      color: #6c757d;
    }
    .issue-details span {
      display: inline-block;
      margin-right: 20px;
      margin-top: 5px;
    }
    .issue-suggestion {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #dee2e6;
      color: #28a745;
      font-style: italic;
    }
    
    .endpoint-section {
      margin: 25px 0;
      padding: 15px;
      background: #fff;
      border-radius: 6px;
      border: 1px solid #e9ecef;
    }
    .endpoint-title {
      font-family: 'Courier New', monospace;
      font-size: 16px;
      color: #2c3e50;
    }
    .endpoint-method {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-right: 10px;
    }
    .method-get { background: #61affe; color: white; }
    .method-post { background: #49cc90; color: white; }
    .method-put { background: #fca130; color: white; }
    .method-patch { background: #50e3c2; color: white; }
    .method-delete { background: #f93e3e; color: white; }
    
    .datasources {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 15px 0;
    }
    .datasource-tag {
      display: inline-block;
      padding: 8px 16px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 20px;
      font-size: 14px;
    }
    
    .suggestions {
      background: #e8f5e9;
      padding: 20px;
      border-radius: 6px;
      margin-top: 20px;
    }
    .suggestions h3 { color: #2e7d32; margin-top: 0; }
    .suggestions ul { margin-left: 20px; margin-top: 10px; }
    .suggestions li { margin: 8px 0; color: #2e7d32; }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #95a5a6;
      font-size: 14px;
    }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 5px;
    }
    .badge-critical { background: #c0392b; color: white; }
    .badge-high { background: #e74c3c; color: white; }
    .badge-medium { background: #f39c12; color: white; }
    .badge-low { background: #3498db; color: white; }
    .badge-info { background: #95a5a6; color: white; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Schema Drift 检查报告</h1>
    <p style="color: #7f8c8d; margin-bottom: 30px;">生成时间: ${new Date().toLocaleString()}</p>`);

    if (summary.hasIssues) {
      htmlParts.push(`
    <div class="summary-card">
      <h2>⚠️ 发现 Schema 漂移问题</h2>
      <p style="font-size: 18px; margin-bottom: 10px;">
        共发现 <strong>${summary.totalIssues}</strong> 个问题，
        影响 <strong>${summary.affectedEndpoints}</strong> / ${summary.totalEndpoints} 个端点
      </p>
      <div class="stats-grid">`);
      
      if (summary.criticalCount > 0) htmlParts.push(`
        <div class="stat-item">
          <div class="stat-value">${summary.criticalCount}</div>
          <div class="stat-label">严重</div>
        </div>`);
      if (summary.highCount > 0) htmlParts.push(`
        <div class="stat-item">
          <div class="stat-value">${summary.highCount}</div>
          <div class="stat-label">高危</div>
        </div>`);
      if (summary.mediumCount > 0) htmlParts.push(`
        <div class="stat-item">
          <div class="stat-value">${summary.mediumCount}</div>
          <div class="stat-label">中等</div>
        </div>`);
      if (summary.lowCount > 0) htmlParts.push(`
        <div class="stat-item">
          <div class="stat-value">${summary.lowCount}</div>
          <div class="stat-label">低危</div>
        </div>`);
      
      htmlParts.push(`
      </div>
    </div>`);
    } else {
      htmlParts.push(`
    <div class="summary-card success">
      <h2>✅ 所有检查通过</h2>
      <p style="font-size: 18px;">未发现任何 Schema 漂移问题。所有数据源的 Schema 保持一致。</p>
    </div>`);
    }

    if (dataSources && dataSources.length > 0) {
      htmlParts.push(`
    <h2>📁 检查的数据源</h2>
    <div class="datasources">`);
      for (const source of dataSources) {
        htmlParts.push(`
      <span class="datasource-tag">${this.getDataSourceLabel(source)}</span>`);
      }
      htmlParts.push(`
    </div>`);
    }

    if (summary.hasIssues && issues.length > 0) {
      htmlParts.push(`
    <h2>🔍 问题详情</h2>`);

      const issuesBySeverity = this.groupBySeverity(issues);
      
      for (const severity of this.severityOrder) {
        const severityIssues = issuesBySeverity[severity] || [];
        if (severityIssues.length === 0) continue;

        const severityLabel = this.severityLabels[severity];
        const severityIcon = this.getSeverityIcon(severity);
        
        htmlParts.push(`
    <h3>${severityIcon} ${severityLabel} (${severityIssues.length})</h3>`);

        const issuesByEndpoint = this.groupByEndpoint(severityIssues);
        
        for (const [endpointKey, endpointIssues] of Object.entries(issuesByEndpoint)) {
          const [method, path] = endpointKey.split(' ');
          const methodClass = `method-${method.toLowerCase()}`;
          
          htmlParts.push(`
    <div class="endpoint-section">
      <div class="endpoint-title">
        <span class="endpoint-method ${methodClass}">${method}</span>
        ${path}
      </div>`);
          
          for (const issue of endpointIssues) {
            htmlParts.push(this.formatHtmlIssue(issue));
          }
          
          htmlParts.push(`
    </div>`);
        }
      }

      const uniqueSuggestions = this.getUniqueSuggestions(issues);
      if (uniqueSuggestions.length > 0) {
        htmlParts.push(`
    <div class="suggestions">
      <h3>💡 修复建议</h3>
      <ul>`);
        for (const suggestion of uniqueSuggestions) {
          htmlParts.push(`
        <li>${suggestion}</li>`);
        }
        htmlParts.push(`
      </ul>
    </div>`);
      }
    }

    htmlParts.push(`
    <div class="footer">
      <p>此报告由 Schema Drift Checker 生成</p>
    </div>
  </div>
</body>
</html>`);

    return htmlParts.join('');
  }

  formatMarkdownIssue(issue) {
    const categoryLabel = this.categoryLabels[issue.category] || issue.category;
    const lines = [];
    
    lines.push(`**[${categoryLabel}]** ${issue.message}`);
    lines.push('');
    
    if (issue.field) {
      lines.push(`- **字段**: \`${issue.field}\``);
    }
    
    if (issue.expected !== undefined && issue.actual !== undefined) {
      lines.push(`- **期望**: \`${issue.expected}\``);
      lines.push(`- **实际**: \`${issue.actual}\``);
    }
    
    if (issue.source1 && issue.source2) {
      lines.push(`- **比较**: ${issue.source1} ↔ ${issue.source2}`);
    }
    
    if (issue.source?.filePath) {
      lines.push(`- **位置**: ${issue.source.filePath}`);
      if (issue.source.lineNumber !== undefined) {
        lines.push(`- **行号**: ${issue.source.lineNumber}`);
      }
    }
    
    if (issue.suggestion) {
      lines.push(`- **💡 建议**: ${issue.suggestion}`);
    }
    
    return lines.join('\n');
  }

  formatHtmlIssue(issue) {
    const categoryLabel = this.categoryLabels[issue.category] || issue.category;
    const severityClass = issue.severity;
    
    let detailsHtml = '';
    
    if (issue.field) {
      detailsHtml += `<span><strong>字段:</strong> <code>${issue.field}</code></span>`;
    }
    
    if (issue.expected !== undefined && issue.actual !== undefined) {
      detailsHtml += `<span><strong>期望:</strong> <code>${issue.expected}</code></span>`;
      detailsHtml += `<span><strong>实际:</strong> <code>${issue.actual}</code></span>`;
    }
    
    if (issue.source1 && issue.source2) {
      detailsHtml += `<span><strong>比较:</strong> ${issue.source1} ↔ ${issue.source2}</span>`;
    }
    
    if (issue.source?.filePath) {
      let location = issue.source.filePath;
      if (issue.source.lineNumber !== undefined) {
        location += `:${issue.source.lineNumber}`;
      }
      detailsHtml += `<span><strong>位置:</strong> ${location}</span>`;
    }

    let suggestionHtml = '';
    if (issue.suggestion) {
      suggestionHtml = `<div class="issue-suggestion">💡 ${issue.suggestion}</div>`;
    }

    return `
      <div class="issue ${severityClass}">
        <div class="issue-header">
          <span class="issue-category">${categoryLabel}</span>
          <span class="issue-severity"><span class="badge badge-${severityClass}">${this.severityLabels[issue.severity]}</span></span>
        </div>
        <div class="issue-message">${issue.message}</div>
        ${detailsHtml ? `<div class="issue-details">${detailsHtml}</div>` : ''}
        ${suggestionHtml}
      </div>`;
  }

  getDataSourceLabel(source) {
    const labels = {
      openapi: '📄 OpenAPI 文档',
      mock: '🎭 Mock 数据',
      fixture: '🧪 Test Fixtures',
      captured: '📡 抓包响应'
    };
    return labels[source] || source;
  }

  getSeverityIcon(severity) {
    const icons = {
      [IssueSeverity.CRITICAL]: '🔴',
      [IssueSeverity.HIGH]: '🟠',
      [IssueSeverity.MEDIUM]: '🟡',
      [IssueSeverity.LOW]: '🔵',
      [IssueSeverity.INFO]: '⚪'
    };
    return icons[severity] || '⚪';
  }

  groupBySeverity(issues) {
    return issues.reduce((acc, issue) => {
      if (!acc[issue.severity]) {
        acc[issue.severity] = [];
      }
      acc[issue.severity].push(issue);
      return acc;
    }, {});
  }

  groupByEndpoint(issues) {
    return issues.reduce((acc, issue) => {
      const key = issue.endpoint 
        ? `${issue.endpoint.method} ${issue.endpoint.path}` 
        : 'Unknown';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(issue);
      return acc;
    }, {});
  }

  getUniqueSuggestions(issues) {
    const uniqueSuggestions = new Set();
    for (const issue of issues) {
      if (issue.suggestion) {
        uniqueSuggestions.add(issue.suggestion);
      }
    }
    return Array.from(uniqueSuggestions);
  }
}

module.exports = ExportReporter;
