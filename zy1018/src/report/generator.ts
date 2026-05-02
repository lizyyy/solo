import type { Plan, CheckReport, CheckResult, ObjectType, CheckSeverity, BoothObject } from '../models/types';
import { runAllChecks } from '../checker/rules';

function generateCheckReport(plan: Plan): CheckReport {
  const checks = runAllChecks(plan);
  
  const objectSummary: CheckReport['objectSummary'] = [];
  const typeMap = new Map<ObjectType, CheckReport['objectSummary'][0]>();
  
  for (const obj of plan.objects) {
    if (!typeMap.has(obj.type)) {
      typeMap.set(obj.type, {
        type: obj.type,
        count: 0,
        items: [],
      });
    }
    const summary = typeMap.get(obj.type)!;
    summary.count++;
    summary.items.push({
      name: obj.name,
      position: { ...obj.position },
      dimensions: { ...obj.dimensions },
    });
  }
  
  objectSummary.push(...typeMap.values());
  
  const severityCounts = {
    error: 0,
    warning: 0,
    info: 0,
  };
  
  for (const check of checks) {
    severityCounts[check.severity]++;
  }
  
  return {
    planId: plan.id,
    planName: plan.name,
    generatedAt: Date.now(),
    summary: {
      total: checks.length,
      errors: severityCounts.error,
      warnings: severityCounts.warning,
      infos: severityCounts.info,
    },
    objectSummary,
    checks,
  };
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSeverityEmoji(severity: CheckSeverity): string {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
  }
}

function getSeverityLabel(severity: CheckSeverity): string {
  switch (severity) {
    case 'error': return '错误';
    case 'warning': return '警告';
    case 'info': return '提示';
  }
}

function getObjectTypeLabel(type: ObjectType): string {
  const labels: Record<ObjectType, string> = {
    table: '桌子',
    display_rack: '展架',
    cashier_desk: '收银台',
    power_outlet: '电源插座',
    power_cable: '电源线',
    entrance: '入口',
    exit: '出口',
    safety_aisle: '安全通道',
    feature_wall: '主视觉墙',
  };
  return labels[type] || type;
}

function formatPosition(pos: { x: number; y: number; z: number }): string {
  return `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`;
}

function formatDimensions(dim: { x: number; y: number; z: number }): string {
  return `${dim.x.toFixed(2)}m × ${dim.y.toFixed(2)}m × ${dim.z.toFixed(2)}m`;
}

export function generateMarkdownReport(plan: Plan): string {
  const report = generateCheckReport(plan);
  
  const lines: string[] = [];
  
  lines.push(`# 摊位布置检查报告`);
  lines.push('');
  lines.push(`> 方案名称: ${report.planName}`);
  lines.push(`> 生成时间: ${formatDateTime(report.generatedAt)}`);
  lines.push('');
  
  lines.push('## 📊 检查摘要');
  lines.push('');
  lines.push('| 类别 | 数量 |');
  lines.push('|------|------|');
  lines.push(`| ❌ 错误 | ${report.summary.errors} |`);
  lines.push(`| ⚠️ 警告 | ${report.summary.warnings} |`);
  lines.push(`| ℹ️ 提示 | ${report.summary.infos} |`);
  lines.push(`| **总计** | **${report.summary.total}** |`);
  lines.push('');
  
  if (report.summary.errors > 0) {
    lines.push('> ⚠️ **注意**: 本方案存在错误级别问题，建议在现场布置前修复。');
    lines.push('');
  }
  
  lines.push('## 📦 物件清单');
  lines.push('');
  
  for (const summary of report.objectSummary) {
    lines.push(`### ${getObjectTypeLabel(summary.type)} (${summary.count}件)`);
    lines.push('');
    lines.push('| 名称 | 位置 | 尺寸 |');
    lines.push('|------|------|------|');
    for (const item of summary.items) {
      lines.push(`| ${item.name} | ${formatPosition(item.position)} | ${formatDimensions(item.dimensions)} |`);
    }
    lines.push('');
  }
  
  lines.push('## 🔍 详细检查结果');
  lines.push('');
  
  const groupedChecks = new Map<CheckSeverity, CheckResult[]>();
  groupedChecks.set('error', []);
  groupedChecks.set('warning', []);
  groupedChecks.set('info', []);
  
  for (const check of report.checks) {
    groupedChecks.get(check.severity)!.push(check);
  }
  
  const severityOrder: CheckSeverity[] = ['error', 'warning', 'info'];
  
  for (const severity of severityOrder) {
    const checks = groupedChecks.get(severity)!;
    if (checks.length === 0) continue;
    
    lines.push(`### ${getSeverityEmoji(severity)} ${getSeverityLabel(severity)} (${checks.length}项)`);
    lines.push('');
    
    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      lines.push(`#### ${i + 1}. ${check.message}`);
      lines.push('');
      
      if (check.suggestions && check.suggestions.length > 0) {
        lines.push('**💡 建议调整方案:**');
        lines.push('');
        for (const suggestion of check.suggestions) {
          lines.push(`- ${suggestion}`);
        }
        lines.push('');
      }
    }
  }
  
  lines.push('## 📐 场地信息');
  lines.push('');
  lines.push(`- 场地尺寸: ${plan.floor.width}m × ${plan.floor.depth}m`);
  lines.push(`- 网格大小: ${plan.floor.gridSize}m`);
  lines.push(`- 最小通道宽度: ${plan.mainAisle.minWidth}m`);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push(`> 此报告由 **Booth Planner 3D** 生成`);
  lines.push(`> 生成时间: ${formatDateTime(report.generatedAt)}`);
  
  return lines.join('\n');
}

export function generateHtmlReport(plan: Plan): string {
  const report = generateCheckReport(plan);
  const markdown = generateMarkdownReport(plan);
  
  const severityColors = {
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
  };
  
  const objectTypeColors: Record<ObjectType, string> = {
    table: '#8B5A2B',
    display_rack: '#C8C8C8',
    cashier_desk: '#3C3C3C',
    power_outlet: '#FFC800',
    power_cable: '#323232',
    entrance: '#228B22',
    exit: '#B22222',
    safety_aisle: '#FFA500',
    feature_wall: '#6495ED',
  };
  
  function renderCheckResult(check: CheckResult, index: number): string {
    const bgColor = severityColors[check.severity];
    return `
      <div class="check-item check-${check.severity}" style="border-left: 4px solid ${bgColor}; padding: 16px; margin-bottom: 16px; background: #f8fafc; border-radius: 0 8px 8px 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px;">${getSeverityEmoji(check.severity)}</span>
          <span style="font-weight: 600; color: ${bgColor};">${getSeverityLabel(check.severity)}</span>
          <span style="color: #64748b; font-size: 14px;">#${index + 1}</span>
        </div>
        <p style="margin: 0 0 12px 0; color: #1e293b; font-size: 15px;">${check.message}</p>
        ${check.suggestions && check.suggestions.length > 0 ? `
          <div style="background: #fff7ed; padding: 12px; border-radius: 6px; border: 1px solid #fed7aa;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; color: #c2410c; font-weight: 600; font-size: 14px;">
              <span>💡</span>
              <span>建议调整方案</span>
            </div>
            <ul style="margin: 0; padding-left: 20px; color: #431407;">
              ${check.suggestions.map(s => `<li style="margin-bottom: 4px;">${s}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>摊位布置检查报告 - ${report.planName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      line-height: 1.6;
      padding: 24px;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 8px;
    }
    .header .meta {
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 32px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .summary-card {
      text-align: center;
      padding: 20px;
      border-radius: 8px;
    }
    .summary-card.error { background: #fef2f2; }
    .summary-card.warning { background: #fffbeb; }
    .summary-card.info { background: #eff6ff; }
    .summary-card .count {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .summary-card.error .count { color: #dc2626; }
    .summary-card.warning .count { color: #d97706; }
    .summary-card.info .count { color: #2563eb; }
    .summary-card .label {
      font-size: 14px;
      color: #64748b;
    }
    .alert-box {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .alert-box .icon { font-size: 24px; }
    .alert-box .text { color: #78350f; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 14px;
    }
    td {
      color: #334155;
      font-size: 14px;
    }
    tr:hover td { background: #f8fafc; }
    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      margin: 4px;
    }
    .footer {
      text-align: center;
      padding: 24px;
      color: #64748b;
      font-size: 13px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 摊位布置检查报告</h1>
      <div class="meta">
        方案名称: ${report.planName} | 生成时间: ${formatDateTime(report.generatedAt)}
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">📊 检查摘要</div>
        <div class="summary-cards">
          <div class="summary-card error">
            <div class="count">${report.summary.errors}</div>
            <div class="label">❌ 错误</div>
          </div>
          <div class="summary-card warning">
            <div class="count">${report.summary.warnings}</div>
            <div class="label">⚠️ 警告</div>
          </div>
          <div class="summary-card info">
            <div class="count">${report.summary.infos}</div>
            <div class="label">ℹ️ 提示</div>
          </div>
        </div>
        ${report.summary.errors > 0 ? `
          <div class="alert-box">
            <span class="icon">⚠️</span>
            <div class="text"><strong>注意:</strong> 本方案存在错误级别问题，建议在现场布置前修复。</div>
          </div>
        ` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">📦 物件清单</div>
        ${report.objectSummary.map(summary => `
          <div style="margin-bottom: 20px;">
            <h4 style="margin-bottom: 12px; color: #475569;">
              ${getObjectTypeLabel(summary.type)} 
              <span class="type-badge" style="background: ${objectTypeColors[summary.type]}20; color: ${objectTypeColors[summary.type]};">
                ${summary.count}件
              </span>
            </h4>
            <table>
              <thead>
                <tr>
                  <th>名称</th>
                  <th>位置</th>
                  <th>尺寸</th>
                </tr>
              </thead>
              <tbody>
                ${summary.items.map(item => `
                  <tr>
                    <td style="font-weight: 500;">${item.name}</td>
                    <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${formatPosition(item.position)}</code></td>
                    <td>${formatDimensions(item.dimensions)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </div>
      
      <div class="section">
        <div class="section-title">🔍 详细检查结果</div>
        ${['error', 'warning', 'info'].map(severity => {
          const checks = report.checks.filter(c => c.severity === severity);
          if (checks.length === 0) return '';
          return `
            <h4 style="margin: 20px 0 12px 0; color: ${severityColors[severity as CheckSeverity]}; display: flex; align-items: center; gap: 8px;">
              ${getSeverityEmoji(severity as CheckSeverity)}
              ${getSeverityLabel(severity as CheckSeverity)}
              <span style="background: ${severityColors[severity as CheckSeverity]}20; padding: 2px 8px; border-radius: 10px; font-size: 13px;">${checks.length}项</span>
            </h4>
            ${checks.map((check, index) => renderCheckResult(check, index)).join('')}
          `;
        }).join('')}
      </div>
      
      <div class="section">
        <div class="section-title">📐 场地信息</div>
        <table>
          <tbody>
            <tr>
              <td style="font-weight: 500;">场地尺寸</td>
              <td>${plan.floor.width}m × ${plan.floor.depth}m</td>
            </tr>
            <tr>
              <td style="font-weight: 500;">网格大小</td>
              <td>${plan.floor.gridSize}m</td>
            </tr>
            <tr>
              <td style="font-weight: 500;">最小通道宽度</td>
              <td>${plan.mainAisle.minWidth}m</td>
            </tr>
            <tr>
              <td style="font-weight: 500;">物件总数</td>
              <td>${plan.objects.length} 件</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="footer">
      此报告由 <strong>Booth Planner 3D</strong> 生成 | ${formatDateTime(report.generatedAt)}
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
}

export { generateCheckReport };
