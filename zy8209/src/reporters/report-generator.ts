import * as fs from 'fs';
import { Issue, RiskReport } from '../types';

export async function generateCsvReport(issues: Issue[], outputPath: string): Promise<void> {
  const headers = [
    'ID',
    'Resource',
    'Resource Type',
    'Issue Type',
    'Severity',
    'Description',
    'Affected Actions',
    'Affected Principals',
    'Is Exception',
    'Exception Reason'
  ];

  const rows = issues.map(issue => [
    issue.id,
    issue.resource,
    issue.resource_type,
    issue.issue_type,
    issue.severity,
    `"${issue.description.replace(/"/g, '""')}"`,
    issue.affected_actions ? `"${issue.affected_actions.join(', ').replace(/"/g, '""')}"` : '',
    issue.affected_principals ? `"${issue.affected_principals.join(', ').replace(/"/g, '""')}"` : '',
    issue.is_exception ? 'Yes' : 'No',
    issue.exception_reason ? `"${issue.exception_reason.replace(/"/g, '""')}"` : ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  fs.writeFileSync(outputPath, csvContent, 'utf-8');
}

export async function generateMarkdownReport(report: RiskReport, outputPath: string): Promise<void> {
  const { summary, resources, issues, statistics } = report;
  
  const severityColors: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };

  const issueTypeNames: Record<string, string> = {
    wildcard_permission: '通配符权限',
    cross_account_trust: '跨账号信任',
    public_bucket: '公开存储桶',
    unregistered_owner: '未登记 Owner',
    unknown: '未知问题'
  };

  let mdContent = `# 云资源安全风险报告

## 报告概览

**生成时间**: ${new Date().toLocaleString('zh-CN')}

### 问题统计

| 严重级别 | 数量 |
|----------|------|
| 🔴 Critical | ${summary.critical_count} |
| 🟠 High | ${summary.high_count} |
| 🟡 Medium | ${summary.medium_count} |
| 🟢 Low | ${summary.low_count} |
| **总计** | **${summary.total_issues}** |
| ⚠️ 例外项 | ${summary.exceptions_count} |

---

## 资源变更分析

### 新增资源 (${resources.new_resources.length} 个)

${resources.new_resources.length === 0 
  ? '无新增资源' 
  : resources.new_resources.map(r => `- \`${r.address}\` (${r.type})`).join('\n')}

### 修改资源 (${resources.modified_resources.length} 个)

${resources.modified_resources.length === 0 
  ? '无修改资源' 
  : resources.modified_resources.map(r => `- \`${r.address}\` (${r.type})`).join('\n')}

---

## 安全问题详情

`;

  const nonExceptionIssues = issues.filter(i => !i.is_exception);
  
  if (nonExceptionIssues.length === 0) {
    mdContent += `✅ **未发现安全问题**

`;
  } else {
    const groupedBySeverity: Record<string, Issue[]> = {
      critical: [],
      high: [],
      medium: [],
      low: []
    };

    for (const issue of nonExceptionIssues) {
      if (groupedBySeverity[issue.severity]) {
        groupedBySeverity[issue.severity].push(issue);
      }
    }

    for (const severity of ['critical', 'high', 'medium', 'low']) {
      const severityIssues = groupedBySeverity[severity];
      
      if (severityIssues.length === 0) continue;

      mdContent += `### ${severityColors[severity]} ${severity.toUpperCase()} 级别 (${severityIssues.length} 个)

`;

      for (const issue of severityIssues) {
        mdContent += `#### ${issueTypeNames[issue.issue_type] || issue.issue_type}

- **资源**: \`${issue.resource}\`
- **资源类型**: ${issue.resource_type}
- **描述**: ${issue.description}
${issue.affected_actions && issue.affected_actions.length > 0 
  ? `- **受影响操作**: ${issue.affected_actions.join(', ')}\n` 
  : ''}
${issue.affected_principals && issue.affected_principals.length > 0 
  ? `- **受影响主体**: ${issue.affected_principals.join(', ')}\n` 
  : ''}
`;
      }
    }
  }

  const exceptionIssues = issues.filter(i => i.is_exception);
  
  if (exceptionIssues.length > 0) {
    mdContent += `---

## ⚠️ 例外项 (${exceptionIssues.length} 个)

以下问题已在例外清单中登记，将被忽略:

`;

    for (const issue of exceptionIssues) {
      mdContent += `- **${issueTypeNames[issue.issue_type] || issue.issue_type}**: \`${issue.resource}\`
  - 原因: ${issue.exception_reason || '未提供原因'}

`;
    }
  }

  mdContent += `---

## 统计分析

### 按问题类型分布

${Object.entries(statistics.by_type).map(([type, count]) => 
  `- ${issueTypeNames[type] || type}: ${count} 个`
).join('\n') || '无数据'}

### 按严重级别分布

${Object.entries(statistics.by_severity).map(([severity, count]) => 
  `- ${severityColors[severity] || ''} ${severity}: ${count} 个`
).join('\n') || '无数据'}

---

## 建议

${summary.critical_count > 0 
  ? '### ⚠️ 紧急处理\n\n请立即处理 Critical 级别的问题，这些问题可能导致严重的安全漏洞。\n' 
  : ''}
${summary.high_count > 0 
  ? '### ⚠️ 高优先级\n\n请尽快处理 High 级别的问题。\n' 
  : ''}
${summary.medium_count > 0 
  ? '### 📋 中等优先级\n\n建议在近期处理 Medium 级别的问题。\n' 
  : ''}
${summary.total_issues === 0 
  ? '### ✅ 安全状态良好\n\n当前没有发现安全问题。请继续保持良好的安全实践。\n' 
  : ''}
`;

  fs.writeFileSync(outputPath, mdContent, 'utf-8');
}

export async function generateHtmlGraph(report: RiskReport, outputPath: string): Promise<void> {
  const { summary, issues } = report;
  
  const nonExceptionIssues = issues.filter(i => !i.is_exception);
  
  const severityCounts = {
    critical: summary.critical_count,
    high: summary.high_count,
    medium: summary.medium_count,
    low: summary.low_count
  };

  const typeCounts: Record<string, number> = {};
  for (const issue of nonExceptionIssues) {
    typeCounts[issue.issue_type] = (typeCounts[issue.issue_type] || 0) + 1;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>云资源安全风险报告</title>
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
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }
    .header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .card:hover {
      transform: translateY(-5px);
      box-shadow: 0 15px 40px rgba(0,0,0,0.15);
    }
    .card.critical { border-left: 5px solid #ef4444; }
    .card.high { border-left: 5px solid #f97316; }
    .card.medium { border-left: 5px solid #eab308; }
    .card.low { border-left: 5px solid #22c55e; }
    .card.total { border-left: 5px solid #3b82f6; }
    .card h3 {
      font-size: 0.9rem;
      color: #64748b;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .card .count {
      font-size: 2.5rem;
      font-weight: bold;
    }
    .card.critical .count { color: #ef4444; }
    .card.high .count { color: #f97316; }
    .card.medium .count { color: #eab308; }
    .card.low .count { color: #22c55e; }
    .card.total .count { color: #3b82f6; }
    .charts-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-card {
      background: white;
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .chart-card h2 {
      font-size: 1.3rem;
      color: #1e293b;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .pie-chart-container {
      position: relative;
      width: 100%;
      max-width: 350px;
      margin: 0 auto;
    }
    .pie-chart {
      width: 300px;
      height: 300px;
      border-radius: 50%;
      margin: 0 auto;
      position: relative;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 15px;
      margin-top: 20px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 15px;
      margin-top: 20px;
    }
    .bar-item {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .bar-label {
      width: 180px;
      font-size: 0.95rem;
      color: #475569;
    }
    .bar-container {
      flex: 1;
      height: 30px;
      background: #f1f5f9;
      border-radius: 15px;
      overflow: hidden;
      position: relative;
    }
    .bar-fill {
      height: 100%;
      border-radius: 15px;
      transition: width 0.5s ease;
    }
    .bar-value {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-weight: bold;
      color: #475569;
    }
    .issues-list {
      background: white;
      border-radius: 15px;
      padding: 25px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    .issues-list h2 {
      font-size: 1.3rem;
      color: #1e293b;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    .issue-item {
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 10px;
      border-left: 4px solid;
    }
    .issue-item.critical { background: #fef2f2; border-color: #ef4444; }
    .issue-item.high { background: #fff7ed; border-color: #f97316; }
    .issue-item.medium { background: #fefce8; border-color: #eab308; }
    .issue-item.low { background: #f0fdf4; border-color: #22c55e; }
    .issue-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
    }
    .issue-resource {
      font-family: monospace;
      font-size: 0.95rem;
      color: #1e293b;
      font-weight: 600;
    }
    .issue-severity {
      font-size: 0.8rem;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .issue-severity.critical { background: #ef4444; color: white; }
    .issue-severity.high { background: #f97316; color: white; }
    .issue-severity.medium { background: #eab308; color: #1e293b; }
    .issue-severity.low { background: #22c55e; color: white; }
    .issue-description {
      font-size: 0.9rem;
      color: #64748b;
    }
    .issue-type {
      font-size: 0.8rem;
      color: #94a3b8;
      margin-top: 5px;
    }
    .no-issues {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }
    .no-issues .icon {
      font-size: 4rem;
      margin-bottom: 15px;
    }
    .footer {
      text-align: center;
      color: rgba(255,255,255,0.8);
      margin-top: 30px;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ 云资源安全风险报告</h1>
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>

    <div class="cards">
      <div class="card critical">
        <h3>🔴 Critical</h3>
        <div class="count">${severityCounts.critical}</div>
      </div>
      <div class="card high">
        <h3>🟠 High</h3>
        <div class="count">${severityCounts.high}</div>
      </div>
      <div class="card medium">
        <h3>🟡 Medium</h3>
        <div class="count">${severityCounts.medium}</div>
      </div>
      <div class="card low">
        <h3>🟢 Low</h3>
        <div class="count">${severityCounts.low}</div>
      </div>
      <div class="card total">
        <h3>📊 总计</h3>
        <div class="count">${summary.total_issues}</div>
      </div>
    </div>

    <div class="charts-container">
      <div class="chart-card">
        <h2>📊 按严重级别分布</h2>
        <div class="bar-chart">
          <div class="bar-item">
            <div class="bar-label">🔴 Critical</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${summary.total_issues > 0 ? (severityCounts.critical / summary.total_issues * 100) : 0}%; background: #ef4444;"></div>
              <span class="bar-value">${severityCounts.critical}</span>
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-label">🟠 High</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${summary.total_issues > 0 ? (severityCounts.high / summary.total_issues * 100) : 0}%; background: #f97316;"></div>
              <span class="bar-value">${severityCounts.high}</span>
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-label">🟡 Medium</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${summary.total_issues > 0 ? (severityCounts.medium / summary.total_issues * 100) : 0}%; background: #eab308;"></div>
              <span class="bar-value">${severityCounts.medium}</span>
            </div>
          </div>
          <div class="bar-item">
            <div class="bar-label">🟢 Low</div>
            <div class="bar-container">
              <div class="bar-fill" style="width: ${summary.total_issues > 0 ? (severityCounts.low / summary.total_issues * 100) : 0}%; background: #22c55e;"></div>
              <span class="bar-value">${severityCounts.low}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-card">
        <h2>🎯 按问题类型分布</h2>
        <div class="bar-chart">
          ${Object.entries(typeCounts).length === 0 
            ? '<div class="no-issues"><p>暂无数据</p></div>'
            : Object.entries(typeCounts).map(([type, count]) => {
                const typeNames: Record<string, string> = {
                  wildcard_permission: '通配符权限',
                  cross_account_trust: '跨账号信任',
                  public_bucket: '公开存储桶',
                  unregistered_owner: '未登记 Owner',
                  unknown: '未知问题'
                };
                const maxCount = Math.max(...Object.values(typeCounts), 1);
                const colors: Record<string, string> = {
                  wildcard_permission: '#f97316',
                  cross_account_trust: '#ef4444',
                  public_bucket: '#ef4444',
                  unregistered_owner: '#3b82f6',
                  unknown: '#64748b'
                };
                return `<div class="bar-item">
                  <div class="bar-label">${typeNames[type] || type}</div>
                  <div class="bar-container">
                    <div class="bar-fill" style="width: ${(count / maxCount * 100)}%; background: ${colors[type] || '#64748b'};"></div>
                    <span class="bar-value">${count}</span>
                  </div>
                </div>`;
              }).join('')}
        </div>
      </div>
    </div>

    <div class="issues-list">
      <h2>📋 问题详情</h2>
      ${nonExceptionIssues.length === 0 
        ? `<div class="no-issues">
            <div class="icon">✅</div>
            <p>太棒了！当前没有发现安全问题。</p>
            <p>请继续保持良好的安全实践。</p>
          </div>`
        : nonExceptionIssues
            .sort((a, b) => {
              const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
              return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
            })
            .map(issue => {
              const typeNames: Record<string, string> = {
                wildcard_permission: '通配符权限',
                cross_account_trust: '跨账号信任',
                public_bucket: '公开存储桶',
                unregistered_owner: '未登记 Owner',
                unknown: '未知问题'
              };
              return `<div class="issue-item ${issue.severity}">
                <div class="issue-header">
                  <span class="issue-resource">${issue.resource}</span>
                  <span class="issue-severity ${issue.severity}">${issue.severity}</span>
                </div>
                <div class="issue-description">${issue.description}</div>
                <div class="issue-type">类型: ${typeNames[issue.issue_type] || issue.issue_type} | 资源类型: ${issue.resource_type}</div>
              </div>`;
            }).join('')}
    </div>

    <div class="footer">
      <p>云资源审计 CLI 工具 | Cloud Resource Audit CLI</p>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, htmlContent, 'utf-8');
}
