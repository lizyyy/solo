const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor() {
    this.exportFormats = ['json', 'html', 'markdown'];
  }

  generate(summary, findings, whitelisted, context) {
    const report = {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      context: {
        scanTarget: context.scanTarget || '',
        scanType: context.scanType || '',
        rulesLoaded: context.rulesLoaded || 0,
        whitelistEntries: context.whitelistEntries || 0,
        filesScanned: context.filesScanned || 0
      },
      summary: {
        ...summary,
        whitelistedCount: whitelisted.length
      },
      findings: findings.map(this.sanitizeFinding),
      whitelisted: whitelisted.map(f => ({
        ...this.sanitizeFinding(f),
        whitelistReason: f.whitelistEntry?.reason || ''
      })),
      shouldBlock: summary.shouldBlock,
      blockCodes: summary.blockCodes
    };

    return report;
  }

  sanitizeFinding(f) {
    return {
      ruleId: f.ruleId,
      ruleName: f.ruleName,
      severity: f.severity,
      blockCode: f.blockCode,
      match: f.match,
      source: f.source,
      line: f.line,
      column: f.column,
      description: f.description
    };
  }

  exportJSON(report, filePath) {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, JSON.stringify(report, null, 2), 'utf-8');

    return {
      success: true,
      format: 'json',
      filePath: fullPath
    };
  }

  exportMarkdown(report, filePath) {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const md = this.generateMarkdown(report);
    fs.writeFileSync(fullPath, md, 'utf-8');

    return {
      success: true,
      format: 'markdown',
      filePath: fullPath
    };
  }

  exportHTML(report, filePath) {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const html = this.generateHTML(report);
    fs.writeFileSync(fullPath, html, 'utf-8');

    return {
      success: true,
      format: 'html',
      filePath: fullPath
    };
  }

  generateMarkdown(report) {
    const status = report.shouldBlock ? '❌ 阻断发布' : '✅ 检查通过';
    const lines = [];

    lines.push('# 日志脱敏检查报告');
    lines.push('');
    lines.push(`- **生成时间**: ${report.generatedAt}`);
    lines.push(`- **检查状态**: ${status}`);
    lines.push(`- **扫描目标**: ${report.context.scanTarget}`);
    lines.push(`- **扫描类型**: ${report.context.scanType}`);
    lines.push(`- **加载规则数**: ${report.context.rulesLoaded}`);
    lines.push(`- **白名单条目**: ${report.context.whitelistEntries}`);
    lines.push(`- **扫描文件数**: ${report.context.filesScanned}`);
    lines.push('');

    lines.push('## 检查摘要');
    lines.push('');
    lines.push(`| 严重级别 | 数量 |`);
    lines.push(`|---------|------|`);
    lines.push(`| Critical (致命) | ${report.summary.critical} |`);
    lines.push(`| High (高危) | ${report.summary.high} |`);
    lines.push(`| Medium (中危) | ${report.summary.medium} |`);
    lines.push(`| Low (低危) | ${report.summary.low} |`);
    lines.push(`| 白名单排除 | ${report.summary.whitelistedCount} |`);
    lines.push(`| **总计** | **${report.summary.total}** |`);
    lines.push('');

    if (report.blockCodes.length > 0) {
      lines.push('## 阻断码');
      lines.push('');
      report.blockCodes.forEach(code => {
        lines.push(`- \`${code}\``);
      });
      lines.push('');
    }

    if (report.findings.length > 0) {
      lines.push('## 发现的问题');
      lines.push('');

      const bySeverity = this.groupBySeverity(report.findings);

      for (const severity of ['critical', 'high', 'medium', 'low']) {
        const items = bySeverity[severity];
        if (items && items.length > 0) {
          const label = {
            critical: 'Critical (致命)',
            high: 'High (高危)',
            medium: 'Medium (中危)',
            low: 'Low (低危)'
          }[severity];

          lines.push(`### ${label} (${items.length})`);
          lines.push('');

          items.forEach((f, i) => {
            lines.push(`**${i + 1}. ${f.ruleName}** (\`${f.blockCode}\`)`);
            lines.push(`- 匹配内容: \`${f.match}\``);
            lines.push(`- 位置: ${f.source}:${f.line}:${f.column}`);
            if (f.description) {
              lines.push(`- 描述: ${f.description}`);
            }
            lines.push('');
          });
        }
      }
    }

    if (report.whitelisted.length > 0) {
      lines.push('## 白名单排除的问题');
      lines.push('');
      report.whitelisted.forEach((f, i) => {
        lines.push(`${i + 1}. **${f.ruleName}**: \`${f.match}\` - ${f.whitelistReason || '无原因'}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  generateHTML(report) {
    const status = report.shouldBlock ? 'blocked' : 'passed';
    const statusText = report.shouldBlock ? '阻断发布' : '检查通过';

    const findingsHTML = this.findingsToHTML(report.findings);
    const whitelistedHTML = this.whitelistedToHTML(report.whitelisted);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>日志脱敏检查报告</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; max-width: 1200px; margin: 0 auto; background: #f5f5f5; }
    .container { background: white; border-radius: 8px; padding: 2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 1.5rem; }
    .status { padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-weight: bold; font-size: 1.2rem; }
    .status.blocked { background: #fee; color: #c00; }
    .status.passed { background: #efe; color: #070; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .meta-item { background: #f8f9fa; padding: 1rem; border-radius: 4px; }
    .meta-label { font-size: 0.85rem; color: #666; margin-bottom: 0.25rem; }
    .meta-value { font-weight: bold; color: #333; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-item { text-align: center; padding: 1rem; border-radius: 8px; }
    .summary-item.critical { background: #fee; color: #c00; }
    .summary-item.high { background: #fff3e0; color: #e65100; }
    .summary-item.medium { background: #fff9c4; color: #f57f17; }
    .summary-item.low { background: #e3f2fd; color: #1565c0; }
    .summary-item.whitelisted { background: #f3e5f5; color: #6a1b9a; }
    .summary-count { font-size: 1.5rem; font-weight: bold; }
    .summary-label { font-size: 0.85rem; margin-top: 0.25rem; }
    h2 { margin: 2rem 0 1rem; color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    .finding { background: #fafafa; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; border-left: 4px solid #ccc; }
    .finding.critical { border-left-color: #c00; }
    .finding.high { border-left-color: #e65100; }
    .finding.medium { border-left-color: #f57f17; }
    .finding.low { border-left-color: #1565c0; }
    .finding-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .finding-title { font-weight: bold; color: #333; }
    .finding-code { background: #eee; padding: 2px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem; }
    .finding-detail { margin: 0.25rem 0; color: #555; }
    .finding-match { background: #fff5f5; padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace; }
    pre { background: #f5f5f5; padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
    .block-codes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .block-code { background: #ffcdd2; color: #b71c1c; padding: 0.5rem 1rem; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>日志脱敏检查报告</h1>
    <div class="status ${status}">${statusText}</div>

    <div class="meta">
      <div class="meta-item"><div class="meta-label">生成时间</div><div class="meta-value">${report.generatedAt}</div></div>
      <div class="meta-item"><div class="meta-label">扫描目标</div><div class="meta-value">${report.context.scanTarget}</div></div>
      <div class="meta-item"><div class="meta-label">扫描类型</div><div class="meta-value">${report.context.scanType}</div></div>
      <div class="meta-item"><div class="meta-label">加载规则数</div><div class="meta-value">${report.context.rulesLoaded}</div></div>
      <div class="meta-item"><div class="meta-label">白名单条目</div><div class="meta-value">${report.context.whitelistEntries}</div></div>
      <div class="meta-item"><div class="meta-label">扫描文件数</div><div class="meta-value">${report.context.filesScanned}</div></div>
    </div>

    <h2>检查摘要</h2>
    <div class="summary">
      <div class="summary-item critical"><div class="summary-count">${report.summary.critical}</div><div class="summary-label">Critical</div></div>
      <div class="summary-item high"><div class="summary-count">${report.summary.high}</div><div class="summary-label">High</div></div>
      <div class="summary-item medium"><div class="summary-count">${report.summary.medium}</div><div class="summary-label">Medium</div></div>
      <div class="summary-item low"><div class="summary-count">${report.summary.low}</div><div class="summary-label">Low</div></div>
      <div class="summary-item whitelisted"><div class="summary-count">${report.summary.whitelistedCount}</div><div class="summary-label">白名单</div></div>
    </div>

    ${report.blockCodes.length > 0 ? `<h2>阻断码</h2><div class="block-codes">${report.blockCodes.map(c => `<span class="block-code">${c}</span>`).join('')}</div>` : ''}

    ${findingsHTML}
    ${whitelistedHTML}
  </div>
</body>
</html>`;
  }

  findingsToHTML(findings) {
    if (findings.length === 0) return '';

    const bySeverity = this.groupBySeverity(findings);
    let html = '<h2>发现的问题</h2>';

    for (const severity of ['critical', 'high', 'medium', 'low']) {
      const items = bySeverity[severity];
      if (items && items.length > 0) {
        html += `<h3>${this.severityLabel(severity)} (${items.length})</h3>`;
        items.forEach(f => {
          html += `
            <div class="finding ${severity}">
              <div class="finding-header">
                <span class="finding-title">${f.ruleName}</span>
                <span class="finding-code">${f.blockCode}</span>
              </div>
              <div class="finding-detail"><strong>匹配:</strong> <span class="finding-match">${f.match}</span></div>
              <div class="finding-detail"><strong>位置:</strong> ${f.source}:${f.line}:${f.column}</div>
              ${f.description ? `<div class="finding-detail"><strong>描述:</strong> ${f.description}</div>` : ''}
            </div>
          `;
        });
      }
    }

    return html;
  }

  whitelistedToHTML(whitelisted) {
    if (whitelisted.length === 0) return '';

    let html = '<h2>白名单排除的问题</h2>';
    whitelisted.forEach(f => {
      html += `
        <div class="finding low">
          <div class="finding-header">
            <span class="finding-title">${f.ruleName}</span>
            <span class="finding-code">已排除</span>
          </div>
          <div class="finding-detail"><strong>匹配:</strong> <span class="finding-match">${f.match}</span></div>
          <div class="finding-detail"><strong>原因:</strong> ${f.whitelistReason || '未指定'}</div>
        </div>
      `;
    });

    return html;
  }

  groupBySeverity(findings) {
    const groups = { critical: [], high: [], medium: [], low: [] };
    for (const f of findings) {
      groups[f.severity]?.push(f);
    }
    return groups;
  }

  severityLabel(severity) {
    const labels = {
      critical: 'Critical (致命)',
      high: 'High (高危)',
      medium: 'Medium (中危)',
      low: 'Low (低危)'
    };
    return labels[severity] || severity;
  }
}

module.exports = { ReportGenerator };
