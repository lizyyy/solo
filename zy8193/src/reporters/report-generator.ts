import { stringify } from 'csv-stringify/sync';
import { AnalysisResult, ReportOutput, Issue, IssueSeverity, IssueCategory } from '../types';

interface IssueCounts {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byCategory: { [key in IssueCategory]?: number };
  byLocale: { [locale: string]: number };
}

export class ReportGenerator {
  generate(result: AnalysisResult): ReportOutput {
    const counts = this.countIssues(result);
    
    return {
      issuesCsv: this.generateCsv(result),
      markdownReport: this.generateMarkdown(result, counts),
      htmlPreview: this.generateHtml(result, counts)
    };
  }

  private countIssues(result: AnalysisResult): IssueCounts {
    const counts: IssueCounts = {
      total: result.issues.length,
      errors: 0,
      warnings: 0,
      infos: 0,
      byCategory: {},
      byLocale: {}
    };

    for (const issue of result.issues) {
      if (issue.severity === 'error') counts.errors++;
      else if (issue.severity === 'warning') counts.warnings++;
      else if (issue.severity === 'info') counts.infos++;

      if (!counts.byCategory[issue.category]) {
        counts.byCategory[issue.category] = 0;
      }
      counts.byCategory[issue.category]++;

      if (!counts.byLocale[issue.locale]) {
        counts.byLocale[issue.locale] = 0;
      }
      counts.byLocale[issue.locale]++;
    }

    return counts;
  }

  private generateCsv(result: AnalysisResult): string {
    const records = result.issues.map(issue => ({
      'ID': issue.id,
      'Category': this.formatCategory(issue.category),
      'Severity': issue.severity,
      'Locale': issue.locale,
      'Key': issue.key,
      'Message': issue.message,
      'Expected': issue.context.expected?.join(', ') || '',
      'Actual': issue.context.actual?.join(', ') || '',
      'Value': issue.context.value || '',
      'Limit': issue.context.limit?.toString() || '',
      'Reference': issue.context.reference || ''
    }));

    return stringify(records, {
      header: true,
      quoted: true,
      quoted_string: true
    });
  }

  private generateMarkdown(result: AnalysisResult, counts: IssueCounts): string {
    const lines: string[] = [];

    lines.push('# i18n Preflight Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Keys Analyzed:** ${result.totalKeys}`);
    lines.push(`- **Locales:** ${result.locales.join(', ')}`);
    lines.push(`- **Total Issues:** ${counts.total}`);
    lines.push(`  - 🔴 Errors: ${counts.errors}`);
    lines.push(`  - 🟡 Warnings: ${counts.warnings}`);
    lines.push(`  - ℹ️ Info: ${counts.infos}`);
    lines.push('');

    if (counts.total === 0) {
      lines.push('✅ **All checks passed!**');
      return lines.join('\n');
    }

    lines.push('## Issues by Category');
    lines.push('');
    for (const [category, count] of Object.entries(counts.byCategory)) {
      lines.push(`- **${this.formatCategory(category as IssueCategory)}:** ${count}`);
    }
    lines.push('');

    lines.push('## Issues by Locale');
    lines.push('');
    for (const [locale, count] of Object.entries(counts.byLocale)) {
      lines.push(`- **${locale}:** ${count}`);
    }
    lines.push('');

    lines.push('## Missing Keys');
    lines.push('');
    if (Object.keys(result.missingKeys).length > 0) {
      for (const [locale, keys] of Object.entries(result.missingKeys)) {
        lines.push(`### ${locale} (${keys.length})`);
        lines.push('');
        for (const key of keys) {
          lines.push(`- \`${key}\``);
        }
        lines.push('');
      }
    } else {
      lines.push('✅ No missing keys');
      lines.push('');
    }

    lines.push('## Extra Keys');
    lines.push('');
    if (Object.keys(result.extraKeys).length > 0) {
      for (const [locale, keys] of Object.entries(result.extraKeys)) {
        lines.push(`### ${locale} (${keys.length})`);
        lines.push('');
        for (const key of keys) {
          lines.push(`- \`${key}\``);
        }
        lines.push('');
      }
    } else {
      lines.push('✅ No extra keys');
      lines.push('');
    }

    lines.push('## Unused Keys');
    lines.push('');
    if (result.unusedKeys.length > 0) {
      lines.push(`Found ${result.unusedKeys.length} potentially unused keys:`);
      lines.push('');
      for (const key of result.unusedKeys) {
        lines.push(`- \`${key}\``);
      }
      lines.push('');
    } else {
      lines.push('✅ All keys appear to be in use');
      lines.push('');
    }

    const errors = result.issues.filter(i => i.severity === 'error');
    const warnings = result.issues.filter(i => i.severity === 'warning');
    const infos = result.issues.filter(i => i.severity === 'info');

    if (errors.length > 0) {
      lines.push('## 🔴 Errors');
      lines.push('');
      for (const issue of errors) {
        lines.push(`### \`${issue.key}\` (${issue.locale})`);
        lines.push('');
        lines.push(`**Category:** ${this.formatCategory(issue.category)}`);
        lines.push(``);
        lines.push(`${issue.message}`);
        lines.push('');
        if (issue.context.expected && issue.context.expected.length > 0) {
          lines.push(`- **Expected:** ${issue.context.expected.join(', ')}`);
        }
        if (issue.context.actual && issue.context.actual.length > 0) {
          lines.push(`- **Actual:** ${issue.context.actual.join(', ')}`);
        }
        if (issue.context.value) {
          lines.push(`- **Value:** \`${issue.context.value}\``);
        }
        if (issue.context.limit) {
          lines.push(`- **Limit:** ${issue.context.limit} chars`);
        }
        lines.push('');
      }
    }

    if (warnings.length > 0) {
      lines.push('## 🟡 Warnings');
      lines.push('');
      for (const issue of warnings) {
        lines.push(`### \`${issue.key}\` (${issue.locale})`);
        lines.push('');
        lines.push(`**Category:** ${this.formatCategory(issue.category)}`);
        lines.push('');
        lines.push(`${issue.message}`);
        lines.push('');
      }
    }

    if (infos.length > 0) {
      lines.push('## ℹ️ Information');
      lines.push('');
      for (const issue of infos) {
        lines.push(`- \`${issue.key}\`: ${issue.message}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateHtml(result: AnalysisResult, counts: IssueCounts): string {
    const statusColor = counts.errors > 0 ? 'error' : counts.warnings > 0 ? 'warning' : 'success';
    const statusText = counts.errors > 0 ? 'Issues Found (Requires Attention)' : 
                       counts.warnings > 0 ? 'Warnings Found' : 'All Checks Passed';

    const issuesBySeverity = {
      error: result.issues.filter(i => i.severity === 'error'),
      warning: result.issues.filter(i => i.severity === 'warning'),
      info: result.issues.filter(i => i.severity === 'info')
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>i18n Preflight Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      padding: 30px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    
    .status-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 15px;
    }
    .status-success { background: #48bb78; }
    .status-warning { background: #ed8936; }
    .status-error { background: #f56565; }

    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      border-bottom: 1px solid #eee;
    }
    .stat-card {
      text-align: center;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
    .stat-error .stat-value { color: #f56565; }
    .stat-warning .stat-value { color: #ed8936; }
    .stat-success .stat-value { color: #48bb78; }

    .content { padding: 30px; }
    .section { margin-bottom: 40px; }
    .section h2 {
      font-size: 20px;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
      color: #2d3748;
    }

    .issue-list { list-style: none; }
    .issue-item {
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 6px;
      border-left: 4px solid;
    }
    .issue-item.error { background: #fff5f5; border-color: #f56565; }
    .issue-item.warning { background: #fffaf0; border-color: #ed8936; }
    .issue-item.info { background: #ebf8ff; border-color: #4299e1; }
    
    .issue-key {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-weight: bold;
      font-size: 14px;
    }
    .issue-locale {
      font-size: 12px;
      color: #666;
      margin-left: 10px;
    }
    .issue-message { margin-top: 8px; font-size: 14px; }
    .issue-context {
      margin-top: 8px;
      font-size: 12px;
      color: #666;
    }

    .key-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 15px;
    }
    .key-card {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 6px;
    }
    .key-card .key {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      color: #667eea;
    }

    .no-issues {
      text-align: center;
      padding: 40px;
      color: #666;
    }
    .no-issues .icon { font-size: 48px; margin-bottom: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌍 i18n Preflight Report</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()}</div>
      <div class="meta">Locales: ${result.locales.join(', ')}</div>
      <div class="meta">Total Keys: ${result.totalKeys}</div>
      <div class="status-badge status-${statusColor}">${statusText}</div>
    </div>

    <div class="summary">
      <div class="stat-card stat-error">
        <div class="stat-value">${counts.errors}</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat-card stat-warning">
        <div class="stat-value">${counts.warnings}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card ${counts.infos > 0 ? '' : 'stat-success'}">
        <div class="stat-value">${counts.infos}</div>
        <div class="stat-label">Info</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-value">${result.totalKeys}</div>
        <div class="stat-label">Keys Analyzed</div>
      </div>
    </div>

    <div class="content">
      ${Object.entries(issuesBySeverity).some(([_, list]) => list.length > 0) ? `
        ${this.renderIssueSection('🔴 Errors', 'error', issuesBySeverity.error)}
        ${this.renderIssueSection('🟡 Warnings', 'warning', issuesBySeverity.warning)}
        ${this.renderIssueSection('ℹ️ Information', 'info', issuesBySeverity.info)}
      ` : `
        <div class="no-issues">
          <div class="icon">✅</div>
          <h2>All checks passed!</h2>
          <p>No issues found in your i18n files.</p>
        </div>
      `}

      ${Object.keys(result.missingKeys).length > 0 ? `
        <div class="section">
          <h2>🔑 Missing Keys</h2>
          ${Object.entries(result.missingKeys).map(([locale, keys]) => `
            <h3 style="margin: 20px 0 10px; color: #4a5568;">${locale} (${keys.length} keys)</h3>
            <div class="key-grid">
              ${keys.map(key => `<div class="key-card"><div class="key">${key}</div></div>`).join('')}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${result.unusedKeys.length > 0 ? `
        <div class="section">
          <h2>⚠️ Potentially Unused Keys</h2>
          <div class="key-grid">
            ${result.unusedKeys.map(key => `<div class="key-card"><div class="key">${key}</div></div>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
  }

  private renderIssueSection(title: string, severity: IssueSeverity, issues: Issue[]): string {
    if (issues.length === 0) return '';

    return `
      <div class="section">
        <h2>${title} (${issues.length})</h2>
        <ul class="issue-list">
          ${issues.map(issue => `
            <li class="issue-item ${severity}">
              <div>
                <span class="issue-key">${issue.key}</span>
                <span class="issue-locale">[${issue.locale}]</span>
              </div>
              <div class="issue-message">${issue.message}</div>
              ${this.renderIssueContext(issue)}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  private renderIssueContext(issue: Issue): string {
    const parts: string[] = [];
    
    if (issue.context.expected && issue.context.expected.length > 0) {
      parts.push(`<span><strong>Expected:</strong> ${issue.context.expected.join(', ')}</span>`);
    }
    if (issue.context.actual && issue.context.actual.length > 0) {
      parts.push(`<span><strong>Actual:</strong> ${issue.context.actual.join(', ')}</span>`);
    }
    if (issue.context.value) {
      parts.push(`<span><strong>Value:</strong> <code>${issue.context.value}</code></span>`);
    }
    if (issue.context.limit) {
      parts.push(`<span><strong>Limit:</strong> ${issue.context.limit} chars</span>`);
    }
    if (issue.context.reference) {
      parts.push(`<span><strong>Reference:</strong> ${issue.context.reference}</span>`);
    }

    if (parts.length === 0) return '';
    
    return `<div class="issue-context">${parts.join(' | ')}</div>`;
  }

  private formatCategory(category: IssueCategory): string {
    const names: { [key in IssueCategory]: string } = {
      'missing_key': 'Missing Key',
      'extra_key': 'Extra Key',
      'unused_key': 'Unused Key',
      'placeholder_mismatch': 'Placeholder Mismatch',
      'plural_missing': 'Missing Plural Form',
      'text_too_long': 'Text Too Long',
      'deprecated_key': 'Deprecated Key',
      'invalid_icu': 'Invalid ICU Expression',
      'nested_key_invalid': 'Invalid Nested Key'
    };
    return names[category] || category;
  }
}
