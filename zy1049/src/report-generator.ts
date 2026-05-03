import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginAuditReport, BatchAuditReport, AuditFinding, PermissionAudit } from './types';
import { PermissionAuditor } from './permission-auditor';

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  async generateJsonReport(report: PluginAuditReport): Promise<string> {
    const reportDir = path.join(this.outputDir, report.runId, report.pluginName);
    await fs.mkdir(reportDir, { recursive: true });
    
    const jsonPath = path.join(reportDir, 'audit-report.json');
    const jsonContent = JSON.stringify(report, null, 2);
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    
    return jsonPath;
  }

  async generateBatchJsonReport(report: BatchAuditReport): Promise<string> {
    const reportDir = path.join(this.outputDir, report.runId);
    await fs.mkdir(reportDir, { recursive: true });
    
    const jsonPath = path.join(reportDir, 'batch-audit-report.json');
    const jsonContent = JSON.stringify(report, null, 2);
    await fs.writeFile(jsonPath, jsonContent, 'utf-8');
    
    return jsonPath;
  }

  generateMarkdownReport(report: PluginAuditReport): string {
    const lines: string[] = [];
    
    const hasViolations = PermissionAuditor.hasViolations(report);
    const criticalCount = PermissionAuditor.getSeverityCount(report, 'critical');
    const highCount = PermissionAuditor.getSeverityCount(report, 'high');
    const mediumCount = PermissionAuditor.getSeverityCount(report, 'medium');
    const lowCount = PermissionAuditor.getSeverityCount(report, 'low');

    lines.push(`# 插件权限审计报告`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date(report.generatedAt).toISOString()}`);
    lines.push(`> 运行 ID: ${report.runId}`);
    lines.push('');

    lines.push(`## 插件信息`);
    lines.push('');
    lines.push(`| 字段 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 插件名称 | ${report.pluginName} |`);
    lines.push(`| 版本 | ${report.pluginVersion} |`);
    lines.push(`| 描述 | ${report.manifest.description || '-'} |`);
    lines.push(`| 作者 | ${report.manifest.author || '-'} |`);
    lines.push('');

    lines.push(`## 运行摘要`);
    lines.push('');
    
    const statusBadge = report.runSummary.success 
      ? (hasViolations ? '⚠️ **有违规**' : '✅ **通过**') 
      : (report.runSummary.timeout ? '⏱️ **超时**' : '💥 **崩溃**');
    
    lines.push(`- 状态: ${statusBadge}`);
    lines.push(`- 运行时间: ${report.runSummary.duration}ms`);
    lines.push(`- 开始: ${new Date(report.runSummary.startTime).toISOString()}`);
    lines.push(`- 结束: ${new Date(report.runSummary.endTime).toISOString()}`);
    
    if (report.runSummary.errorMessage) {
      lines.push(`- 错误信息: \`${report.runSummary.errorMessage}\``);
    }
    
    lines.push('');

    lines.push(`## 审计发现`);
    lines.push('');
    lines.push(`- **严重 (Critical)**: ${criticalCount}`);
    lines.push(`- **高 (High)**: ${highCount}`);
    lines.push(`- **中 (Medium)**: ${mediumCount}`);
    lines.push(`- **低 (Low)**: ${lowCount}`);
    lines.push('');

    if (report.findings.length > 0) {
      lines.push(`### 发现详情`);
      lines.push('');
      
      for (const finding of report.findings) {
        const severityEmoji = this.getSeverityEmoji(finding.severity);
        const typeEmoji = finding.type === 'violation' ? '❌' : 
                          finding.type === 'warning' ? '⚠️' : 'ℹ️';
        
        lines.push(`#### ${typeEmoji} ${severityEmoji} [${finding.severity.toUpperCase()}] ${finding.category}`);
        lines.push('');
        lines.push(`**消息**: ${finding.message}`);
        lines.push('');
        
        if (finding.details) {
          lines.push('**详情**:');
          lines.push('');
          lines.push('```json');
          lines.push(JSON.stringify(finding.details, null, 2));
          lines.push('```');
          lines.push('');
        }
        
        if (finding.capability) {
          lines.push(`- 涉及能力: \`${finding.capability}\``);
        }
        lines.push('');
      }
    }

    lines.push(`## 权限审计`);
    lines.push('');
    
    const declaredUsed = report.permissionAudits.filter(p => p.status === 'declared_used');
    const declaredUnused = report.permissionAudits.filter(p => p.status === 'declared_unused');
    const undeclaredUsed = report.permissionAudits.filter(p => p.status === 'undeclared_used' && p.used);
    
    lines.push(`| 状态 | 数量 | 说明 |`);
    lines.push(`|------|------|------|`);
    lines.push(`| ✅ 声明且使用 | ${declaredUsed.length} | 权限声明正确且被使用 |`);
    lines.push(`| ⚠️ 声明但未使用 | ${declaredUnused.length} | 权限声明了但实际未调用 |`);
    lines.push(`| ❌ 未声明却使用 | ${undeclaredUsed.length} | 权限违规，调用了未声明的能力 |`);
    lines.push('');

    lines.push(`### 权限详情`);
    lines.push('');
    
    for (const audit of report.permissionAudits) {
      const statusEmoji = this.getPermissionStatusEmoji(audit.status, audit.used);
      const declaredText = audit.declared ? '✅ 已声明' : '❌ 未声明';
      const usedText = audit.used ? `✅ 已调用 (${audit.callCount}次)` : '❌ 未调用';
      
      lines.push(`#### ${statusEmoji} \`${audit.permission}\``);
      lines.push('');
      lines.push(`- 声明状态: ${declaredText}`);
      lines.push(`- 使用状态: ${usedText}`);
      
      if (audit.calls.length > 0) {
        lines.push('');
        lines.push('**调用记录**:');
        lines.push('');
        
        for (const call of audit.calls.slice(0, 10)) {
          const time = new Date(call.timestamp).toISOString().split('T')[1];
          const result = call.success ? '✅ 成功' : '❌ 失败';
          lines.push(`- ${time} \`${call.method}\` - ${result}`);
          if (call.error) {
            lines.push(`  - 错误: ${call.error}`);
          }
        }
        
        if (audit.calls.length > 10) {
          lines.push(`- ... 还有 ${audit.calls.length - 10} 条记录`);
        }
      }
      lines.push('');
    }

    lines.push(`## 统计信息`);
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 总能力调用次数 | ${report.statistics.totalCapabilityCalls} |`);
    lines.push(`| 声明且使用的权限 | ${report.statistics.declaredUsed} |`);
    lines.push(`| 声明但未使用的权限 | ${report.statistics.declaredUnused} |`);
    lines.push(`| 未声明却使用的权限 | ${report.statistics.undeclaredUsed} |`);
    lines.push(`| 发布事件数 | ${report.statistics.eventsPublished} |`);
    lines.push(`| 订阅事件数 | ${report.statistics.eventsSubscribed} |`);
    lines.push('');

    if (report.consoleOutput.length > 0) {
      lines.push(`## 控制台输出`);
      lines.push('');
      lines.push('```');
      lines.push(...report.consoleOutput.slice(0, 100));
      if (report.consoleOutput.length > 100) {
        lines.push(`... (截断，共 ${report.consoleOutput.length} 行)`);
      }
      lines.push('```');
      lines.push('');
    }

    lines.push(`---`);
    lines.push('');
    lines.push(`*此报告由 Plugin Sandbox Auditor 生成*`);

    return lines.join('\n');
  }

  generateBatchMarkdownReport(report: BatchAuditReport): string {
    const lines: string[] = [];

    lines.push(`# 批量插件权限审计报告`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date(report.generatedAt).toISOString()}`);
    lines.push(`> 运行 ID: ${report.runId}`);
    lines.push('');

    lines.push(`## 总体摘要`);
    lines.push('');
    lines.push(`| 指标 | 数量 |`);
    lines.push(`|------|------|`);
    lines.push(`| 插件总数 | ${report.summary.total} |`);
    lines.push(`| ✅ 通过 | ${report.summary.passed} |`);
    lines.push(`| ❌ 失败 | ${report.summary.failed} |`);
    lines.push(`| 💥 崩溃 | ${report.summary.crashed} |`);
    lines.push(`| ⏱️ 超时 | ${report.summary.timeout} |`);
    lines.push(`| ⚠️ 违规 | ${report.summary.violations} |`);
    lines.push(`| 📢 警告 | ${report.summary.warnings} |`);
    lines.push('');

    lines.push(`## 各插件审计结果`);
    lines.push('');
    lines.push(`| 插件 | 版本 | 状态 | 严重违规 | 高违规 | 中违规 | 低警告 |`);
    lines.push(`|------|------|------|----------|--------|--------|--------|`);

    for (const pluginReport of report.plugins) {
      const hasViolations = PermissionAuditor.hasViolations(pluginReport);
      const critical = PermissionAuditor.getSeverityCount(pluginReport, 'critical');
      const high = PermissionAuditor.getSeverityCount(pluginReport, 'high');
      const medium = PermissionAuditor.getSeverityCount(pluginReport, 'medium');
      const low = PermissionAuditor.getSeverityCount(pluginReport, 'low');
      
      let status = '✅ 通过';
      if (!pluginReport.runSummary.success) {
        status = pluginReport.runSummary.timeout ? '⏱️ 超时' : '💥 崩溃';
      } else if (hasViolations) {
        status = '⚠️ 有违规';
      }

      lines.push(`| ${pluginReport.pluginName} | ${pluginReport.pluginVersion} | ${status} | ${critical} | ${high} | ${medium} | ${low} |`);
    }
    lines.push('');

    lines.push(`---`);
    lines.push('');
    lines.push(`*此报告由 Plugin Sandbox Auditor 生成*`);

    return lines.join('\n');
  }

  async generateMarkdownReportFile(report: PluginAuditReport): Promise<string> {
    const reportDir = path.join(this.outputDir, report.runId, report.pluginName);
    await fs.mkdir(reportDir, { recursive: true });
    
    const mdPath = path.join(reportDir, 'audit-report.md');
    const mdContent = this.generateMarkdownReport(report);
    await fs.writeFile(mdPath, mdContent, 'utf-8');
    
    return mdPath;
  }

  async generateBatchMarkdownReportFile(report: BatchAuditReport): Promise<string> {
    const reportDir = path.join(this.outputDir, report.runId);
    await fs.mkdir(reportDir, { recursive: true });
    
    const mdPath = path.join(reportDir, 'batch-audit-report.md');
    const mdContent = this.generateBatchMarkdownReport(report);
    await fs.writeFile(mdPath, mdContent, 'utf-8');
    
    return mdPath;
  }

  async generateFullReport(report: PluginAuditReport): Promise<{ json: string; markdown: string }> {
    const jsonPath = await this.generateJsonReport(report);
    const mdPath = await this.generateMarkdownReportFile(report);
    
    return { json: jsonPath, markdown: mdPath };
  }

  async generateFullBatchReport(report: BatchAuditReport): Promise<{ json: string; markdown: string }> {
    const jsonPath = await this.generateBatchJsonReport(report);
    const mdPath = await this.generateBatchMarkdownReportFile(report);
    
    return { json: jsonPath, markdown: mdPath };
  }

  private getSeverityEmoji(severity: AuditFinding['severity']): string {
    const map: Record<AuditFinding['severity'], string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
    };
    return map[severity] || '⚪';
  }

  private getPermissionStatusEmoji(status: PermissionAudit['status'], used: boolean): string {
    switch (status) {
      case 'declared_used':
        return '✅';
      case 'declared_unused':
        return '⚠️';
      case 'undeclared_used':
        return used ? '❌' : '➖';
      default:
        return '➖';
    }
  }

  generateHtmlReport(report: PluginAuditReport): string {
    const hasViolations = PermissionAuditor.hasViolations(report);
    const criticalCount = PermissionAuditor.getSeverityCount(report, 'critical');
    const highCount = PermissionAuditor.getSeverityCount(report, 'high');
    const mediumCount = PermissionAuditor.getSeverityCount(report, 'medium');

    const statusClass = report.runSummary.success 
      ? (hasViolations ? 'status-warning' : 'status-success') 
      : 'status-error';
    
    const statusText = report.runSummary.success 
      ? (hasViolations ? '有违规' : '通过') 
      : (report.runSummary.timeout ? '超时' : '崩溃');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>插件权限审计报告 - ${report.pluginName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f7fa;
      padding: 40px 20px;
      color: #333;
    }
    .container { 
      max-width: 1200px; 
      margin: 0 auto; 
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 2rem; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 0.9rem; }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 50px;
      font-weight: 600;
      font-size: 1.1rem;
      margin-top: 15px;
    }
    .status-success { background: #d4edda; color: #155724; }
    .status-warning { background: #fff3cd; color: #856404; }
    .status-error { background: #f8d7da; color: #721c24; }
    
    .card {
      background: white;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .card h2 {
      font-size: 1.3rem;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #eee;
      color: #1a1a2e;
    }
    .card h3 {
      font-size: 1.1rem;
      margin: 20px 0 15px;
      color: #2d3748;
    }
    
    .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
      .grid-4 { grid-template-columns: repeat(2, 1fr); }
    }
    
    .stat-box {
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-box .number { font-size: 2rem; font-weight: 700; margin-bottom: 5px; }
    .stat-box .label { font-size: 0.85rem; color: #64748b; }
    .stat-box.critical .number { color: #dc2626; }
    .stat-box.high .number { color: #ea580c; }
    .stat-box.medium .number { color: #ca8a04; }
    .stat-box.low .number { color: #2563eb; }
    
    .finding {
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 12px;
      border-left: 4px solid;
    }
    .finding.critical { background: #fef2f2; border-color: #dc2626; }
    .finding.high { background: #fff7ed; border-color: #ea580c; }
    .finding.medium { background: #fefce8; border-color: #ca8a04; }
    .finding.low { background: #eff6ff; border-color: #2563eb; }
    .finding .title { font-weight: 600; margin-bottom: 8px; }
    .finding .category { 
      display: inline-block; 
      background: rgba(0,0,0,0.05); 
      padding: 2px 8px; 
      border-radius: 4px; 
      font-size: 0.8rem;
      margin-right: 8px;
    }
    
    .permission-item {
      padding: 15px;
      background: #f8fafc;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .permission-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .permission-name {
      font-family: 'SF Mono', Monaco, monospace;
      font-weight: 600;
    }
    .permission-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .badge-ok { background: #dcfce7; color: #166534; }
    .badge-unused { background: #fef9c3; color: #854d0e; }
    .badge-violation { background: #fee2e2; color: #991b1b; }
    
    .call-list {
      margin-top: 10px;
      padding: 10px;
      background: white;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
    }
    .call-item {
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .call-item:last-child { border-bottom: none; }
    .call-success { color: #166534; }
    .call-fail { color: #991b1b; }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
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
    tr:hover { background: #f8fafc; }
    
    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      margin-top: 10px;
    }
    
    .icon { margin-right: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔍 插件权限审计报告</h1>
      <div class="meta">
        生成时间: ${new Date(report.generatedAt).toISOString()} | 
        运行 ID: ${report.runId}
      </div>
      <div class="status-badge ${statusClass}">
        ${statusText}
      </div>
    </div>

    <div class="card">
      <h2>📦 插件信息</h2>
      <div class="grid-2">
        <div class="stat-box">
          <div class="number">${report.pluginName}</div>
          <div class="label">插件名称</div>
        </div>
        <div class="stat-box">
          <div class="number">${report.pluginVersion}</div>
          <div class="label">版本</div>
        </div>
      </div>
      <p style="margin-top: 15px; color: #64748b;">
        ${report.manifest.description || '暂无描述'}
      </p>
    </div>

    <div class="card">
      <h2>⏱️ 运行摘要</h2>
      <div class="grid-2">
        <div class="stat-box">
          <div class="number">${report.runSummary.duration}ms</div>
          <div class="label">运行时长</div>
        </div>
        <div class="stat-box">
          <div class="number">${report.runSummary.success ? '是' : '否'}</div>
          <div class="label">运行成功</div>
        </div>
      </div>
      ${report.runSummary.errorMessage ? `
      <div style="margin-top: 15px; padding: 12px; background: #fef2f2; border-radius: 6px; color: #721c24;">
        <strong>错误:</strong> ${report.runSummary.errorMessage}
      </div>
      ` : ''}
    </div>

    <div class="card">
      <h2>🚨 审计发现</h2>
      <div class="grid-4">
        <div class="stat-box critical">
          <div class="number">${criticalCount}</div>
          <div class="label">严重违规</div>
        </div>
        <div class="stat-box high">
          <div class="number">${highCount}</div>
          <div class="label">高违规</div>
        </div>
        <div class="stat-box medium">
          <div class="number">${mediumCount}</div>
          <div class="label">中违规</div>
        </div>
        <div class="stat-box low">
          <div class="number">${lowCount}</div>
          <div class="label">低警告</div>
        </div>
      </div>
      
      ${report.findings.length > 0 ? `
      <h3>发现详情</h3>
      ${report.findings.map(f => `
      <div class="finding ${f.severity}">
        <div class="title">
          <span class="category">${f.type}</span>
          ${f.capability ? `<code>${f.capability}</code> - ` : ''}${f.message}
        </div>
        ${f.details ? `<pre>${JSON.stringify(f.details, null, 2)}</pre>` : ''}
      </div>
      `).join('')}
      ` : '<p style="color: #64748b;">暂无发现</p>'}
    </div>

    <div class="card">
      <h2>🔒 权限审计</h2>
      
      <table>
        <thead>
          <tr>
            <th>权限</th>
            <th>声明状态</th>
            <th>使用状态</th>
            <th>调用次数</th>
          </tr>
        </thead>
        <tbody>
          ${report.permissionAudits.map(p => `
          <tr>
            <td><code>${p.permission}</code></td>
            <td>${p.declared ? '✅ 已声明' : '❌ 未声明'}</td>
            <td>${p.used ? '✅ 已使用' : '➖ 未使用'}</td>
            <td>${p.callCount}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${report.permissionAudits.some(p => p.calls.length > 0) ? `
      <h3>调用详情</h3>
      ${report.permissionAudits.filter(p => p.calls.length > 0).map(p => `
      <div class="permission-item">
        <div class="permission-header">
          <span class="permission-name">${p.permission}</span>
          <span class="permission-badge ${
            p.status === 'declared_used' ? 'badge-ok' : 
            p.status === 'declared_unused' ? 'badge-unused' : 'badge-violation'
          }">
            ${p.status === 'declared_used' ? '正常' : 
              p.status === 'declared_unused' ? '未使用' : '越权'}
          </span>
        </div>
        <div class="call-list">
          ${p.calls.slice(0, 5).map(c => `
          <div class="call-item">
            <span class="${c.success ? 'call-success' : 'call-fail'}">
              ${c.success ? '✅' : '❌'}
            </span>
            <code>${c.method}</code>
            at ${new Date(c.timestamp).toISOString().split('T')[1]}
            ${c.error ? `<span style="color: #dc2626;">(${c.error})</span>` : ''}
          </div>
          `).join('')}
          ${p.calls.length > 5 ? `<div class="call-item" style="color: #64748b;">... 还有 ${p.calls.length - 5} 条记录</div>` : ''}
        </div>
      </div>
      `).join('')}
      ` : ''}
    </div>

    ${report.consoleOutput.length > 0 ? `
    <div class="card">
      <h2>🖥️ 控制台输出</h2>
      <pre>${report.consoleOutput.slice(0, 50).join('\n')}${report.consoleOutput.length > 50 ? `\n... (共 ${report.consoleOutput.length} 行)` : ''}</pre>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  }
}

export default ReportGenerator;
