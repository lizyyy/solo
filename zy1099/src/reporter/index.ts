import * as path from 'path';
import {
  ExportReport,
  ScanResult,
  ValidateResult,
  RunSnippetsResult,
  FixItem,
  Issue,
  Config,
  ReportSummary,
} from '../types';
import {
  calculateRiskLevel,
  calculateScore,
  ensureDirAsync,
  writeFileAsync,
  formatDuration,
} from '../utils';

export interface ReporterOptions {
  rootPath: string;
  config: Config;
  scanResult: ScanResult;
  validateResult: ValidateResult;
  runSnippetsResult?: RunSnippetsResult;
  version: string;
}

export class Reporter {
  private options: ReporterOptions;

  constructor(options: ReporterOptions) {
    this.options = options;
  }

  private generateFixList(issues: Issue[]): FixItem[] {
    const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'error': 'high',
      'warning': 'medium',
      'info': 'low',
    };

    return issues.map((issue): FixItem => ({
      id: issue.id,
      type: issue.type,
      description: issue.message,
      location: {
        file: issue.file,
        line: issue.line,
      },
      suggestion: issue.suggestion,
      priority: priorityMap[issue.severity],
    }));
  }

  private calculateReportSummary(): ReportSummary {
    const { validateResult, runSnippetsResult } = this.options;

    const validateErrors = validateResult.summary.bySeverity.errors;
    const validateWarnings = validateResult.summary.bySeverity.warnings;
    const validateIssues = validateResult.issues.length;

    let snippetErrors = 0;
    let snippetWarnings = 0;
    let snippetIssues = 0;

    if (runSnippetsResult) {
      snippetErrors = runSnippetsResult.issues.filter(i => i.severity === 'error').length;
      snippetWarnings = runSnippetsResult.issues.filter(i => i.severity === 'warning').length;
      snippetIssues = runSnippetsResult.issues.length;
    }

    const totalErrors = validateErrors + snippetErrors;
    const totalWarnings = validateWarnings + snippetWarnings;

    const totalChecks = Math.max(1, validateIssues + (runSnippetsResult?.summary.totalSnippets || 0));
    const passedChecks = totalChecks - (validateErrors + (runSnippetsResult?.summary.failed || 0));
    const failedChecks = validateErrors + (runSnippetsResult?.summary.failed || 0);
    const skippedChecks = runSnippetsResult?.summary.skipped || 0;

    return {
      score: calculateScore(totalChecks, passedChecks, totalErrors, totalWarnings),
      riskLevel: calculateRiskLevel(totalErrors, totalWarnings),
      totalChecks,
      passedChecks,
      failedChecks,
      skippedChecks,
    };
  }

  generateReport(): ExportReport {
    const { scanResult, validateResult, runSnippetsResult, version, rootPath } = this.options;

    const allIssues = [
      ...validateResult.issues,
      ...(runSnippetsResult?.issues || []),
    ];

    return {
      generatedAt: new Date(),
      version,
      rootPath,
      summary: this.calculateReportSummary(),
      scan: scanResult,
      validate: validateResult,
      runSnippets: runSnippetsResult || {
        executedAt: new Date(),
        rootPath,
        snippets: [],
        results: [],
        issues: [],
        summary: {
          totalSnippets: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          byLanguage: {},
        },
      },
      fixList: this.generateFixList(allIssues),
    };
  }

  private getRiskEmoji(level: string): string {
    const emojis: Record<string, string> = {
      'low': '🟢',
      'medium': '🟡',
      'high': '🔴',
    };
    return emojis[level] || '⚪';
  }

  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      'error': '❌',
      'warning': '⚠️',
      'info': 'ℹ️',
    };
    return emojis[severity] || '📝';
  }

  private formatIssueForMarkdown(issue: Issue): string {
    const lines = [
      `### ${this.getSeverityEmoji(issue.severity)} ${issue.type.toUpperCase()}`,
      '',
      `**文件**: \`${issue.file}\``,
      issue.line > 0 ? `**行号**: ${issue.line}` : null,
      issue.column > 0 ? `**列号**: ${issue.column}` : null,
      '',
      `**问题**: ${issue.message}`,
      '',
      `**建议**: ${issue.suggestion}`,
      '',
    ].filter(Boolean);

    if (issue.context) {
      lines.push('**上下文**:');
      lines.push('```');
      lines.push(issue.context);
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  private toMarkdown(report: ExportReport): string {
    const lines: string[] = [];

    lines.push(`# 课程讲义检查报告`);
    lines.push('');
    lines.push(`> 生成时间: ${report.generatedAt.toISOString()}`);
    lines.push(`> 版本: ${report.version}`);
    lines.push(`> 根目录: \`${report.rootPath}\``);
    lines.push('');

    lines.push(`## 📊 汇总`);
    lines.push('');
    lines.push(`| 指标 | 值 |`);
    lines.push(`|------|-----|`);
    lines.push(`| **评分** | ${report.summary.score}/100 ⭐ |`);
    lines.push(`| **风险等级** | ${this.getRiskEmoji(report.summary.riskLevel)} ${report.summary.riskLevel.toUpperCase()} |`);
    lines.push(`| **总检查数** | ${report.summary.totalChecks} |`);
    lines.push(`| **通过** | ${report.summary.passedChecks} ✅ |`);
    lines.push(`| **失败** | ${report.summary.failedChecks} ❌ |`);
    lines.push(`| **跳过** | ${report.summary.skippedChecks} ⏭️ |`);
    lines.push('');

    lines.push(`## 📁 扫描结果`);
    lines.push('');
    lines.push(`- **总文件数**: ${report.scan.summary.totalFiles}`);
    lines.push('');
    lines.push('| 文件类型 | 数量 |');
    lines.push('|----------|------|');
    Object.entries(report.scan.summary.byType).forEach(([type, count]) => {
      if (count > 0) {
        lines.push(`| ${type} | ${count} |`);
      }
    });
    lines.push('');

    lines.push(`## 🔍 验证结果`);
    lines.push('');
    lines.push(`- **扫描文件数**: ${report.validate.scannedFiles}`);
    lines.push(`- **总问题数**: ${report.validate.summary.totalIssues}`);
    lines.push(`- **错误**: ${report.validate.summary.bySeverity.errors}`);
    lines.push(`- **警告**: ${report.validate.summary.bySeverity.warnings}`);
    lines.push('');

    if (report.validate.issues.length > 0) {
      lines.push(`### 问题详情`);
      lines.push('');
      report.validate.issues.forEach(issue => {
        lines.push(this.formatIssueForMarkdown(issue));
        lines.push('---');
        lines.push('');
      });
    }

    lines.push(`## 🧪 代码片段执行结果`);
    lines.push('');
    lines.push(`- **总代码片段**: ${report.runSnippets.summary.totalSnippets}`);
    lines.push(`- **通过**: ${report.runSnippets.summary.passed} ✅`);
    lines.push(`- **失败**: ${report.runSnippets.summary.failed} ❌`);
    lines.push(`- **跳过**: ${report.runSnippets.summary.skipped} ⏭️`);
    lines.push('');

    if (Object.keys(report.runSnippets.summary.byLanguage).length > 0) {
      lines.push('**按语言统计**:');
      lines.push('');
      lines.push('| 语言 | 数量 |');
      lines.push('|------|------|');
      Object.entries(report.runSnippets.summary.byLanguage).forEach(([lang, count]) => {
        lines.push(`| ${lang} | ${count} |`);
      });
      lines.push('');
    }

    if (report.runSnippets.issues.length > 0) {
      lines.push(`### 执行问题`);
      lines.push('');
      report.runSnippets.issues.forEach(issue => {
        lines.push(this.formatIssueForMarkdown(issue));
        lines.push('---');
        lines.push('');
      });
    }

    if (report.runSnippets.results.length > 0) {
      lines.push(`### 执行详情`);
      lines.push('');
      report.runSnippets.results.forEach(result => {
        const snippet = report.runSnippets.snippets.find(s => s.id === result.snippetId);
        if (!snippet) return;

        lines.push(`#### ${result.success ? '✅' : '❌'} ${snippet.file}:${snippet.line}`);
        lines.push('');
        lines.push(`- **语言**: ${snippet.language}`);
        lines.push(`- **耗时**: ${formatDuration(result.duration)}`);
        if (result.timedOut) {
          lines.push(`- **超时**: 是 ⏰`);
        }
        lines.push('');

        if (result.stdout) {
          lines.push('**标准输出**:');
          lines.push('```');
          lines.push(result.stdout.substring(0, 2000));
          if (result.stdout.length > 2000) lines.push('... (已截断)');
          lines.push('```');
          lines.push('');
        }

        if (result.stderr) {
          lines.push('**标准错误**:');
          lines.push('```');
          lines.push(result.stderr.substring(0, 2000));
          if (result.stderr.length > 2000) lines.push('... (已截断)');
          lines.push('```');
          lines.push('');
        }
      });
    }

    lines.push(`## 🛠️ 修复清单`);
    lines.push('');
    if (report.fixList.length === 0) {
      lines.push('没有需要修复的问题！🎉');
    } else {
      lines.push('| 优先级 | 类型 | 文件 | 问题 | 建议 |');
      lines.push('|--------|------|------|------|------|');
      report.fixList.forEach(item => {
        const priorityEmoji = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
        lines.push(`| ${priorityEmoji} | ${item.type} | ${item.location.file}:${item.location.line} | ${item.description.substring(0, 50)} | ${item.suggestion.substring(0, 80)} |`);
      });
    }

    return lines.join('\n');
  }

  private toHtml(report: ExportReport): string {
    const riskColorMap: Record<string, string> = {
      'low': 'success',
      'medium': 'warning',
      'high': 'danger',
    };

    const severityColorMap: Record<string, string> = {
      'error': 'danger',
      'warning': 'warning',
      'info': 'info',
    };

    const formatIssue = (issue: Issue): string => {
      const severity = severityColorMap[issue.severity];
      return `
        <div class="card mb-3 border-${severity}">
          <div class="card-header bg-${severity} text-white">
            <strong>${issue.type.toUpperCase()}</strong>
          </div>
          <div class="card-body">
            <p><strong>文件:</strong> <code>${issue.file}</code></p>
            ${issue.line > 0 ? `<p><strong>行号:</strong> ${issue.line}</p>` : ''}
            ${issue.column > 0 ? `<p><strong>列号:</strong> ${issue.column}</p>` : ''}
            <p><strong>问题:</strong> ${issue.message}</p>
            <p><strong>建议:</strong> ${issue.suggestion}</p>
            ${issue.context ? `<pre class="bg-light p-2 rounded"><code>${issue.context}</code></pre>` : ''}
          </div>
        </div>
      `;
    };

    const formatResult = (result: typeof report.runSnippets.results[0]): string => {
      const snippet = report.runSnippets.snippets.find(s => s.id === result.snippetId);
      if (!snippet) return '';

      return `
        <div class="card mb-3">
          <div class="card-header ${result.success ? 'bg-success' : 'bg-danger'} text-white">
            ${result.success ? '✅' : '❌'} ${snippet.file}:${snippet.line}
          </div>
          <div class="card-body">
            <p><strong>语言:</strong> ${snippet.language}</p>
            <p><strong>耗时:</strong> ${formatDuration(result.duration)}</p>
            ${result.timedOut ? '<p><strong>超时:</strong> 是 ⏰</p>' : ''}
            ${result.stdout ? `<h6>标准输出:</h6><pre class="bg-light p-2 rounded"><code>${result.stdout.substring(0, 2000)}</code></pre>` : ''}
            ${result.stderr ? `<h6>标准错误:</h6><pre class="bg-light p-2 rounded"><code>${result.stderr.substring(0, 2000)}</code></pre>` : ''}
          </div>
        </div>
      `;
    };

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>课程讲义检查报告</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { padding-top: 20px; padding-bottom: 20px; }
    .score-circle {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      margin: 0 auto;
    }
    .score-high { background: linear-gradient(135deg, #28a745, #20c997); color: white; }
    .score-medium { background: linear-gradient(135deg, #ffc107, #fd7e14); color: white; }
    .score-low { background: linear-gradient(135deg, #dc3545, #c82333); color: white; }
  </style>
</head>
<body>
  <div class="container">
    <header class="mb-4">
      <h1 class="display-4 text-center mb-3">课程讲义检查报告</h1>
      <p class="text-muted text-center">
        生成时间: ${report.generatedAt.toLocaleString('zh-CN')} | 
        版本: ${report.version}
      </p>
      <p class="text-center text-muted">根目录: <code>${report.rootPath}</code></p>
    </header>

    <section class="mb-5">
      <h2>📊 汇总</h2>
      <div class="row align-items-center">
        <div class="col-md-4 text-center">
          <div class="score-circle ${report.summary.score >= 80 ? 'score-high' : report.summary.score >= 50 ? 'score-medium' : 'score-low'}">
            ${report.summary.score}
          </div>
          <p class="mt-2">综合评分</p>
        </div>
        <div class="col-md-8">
          <table class="table table-striped">
            <tbody>
              <tr>
                <td>风险等级</td>
                <td><span class="badge bg-${riskColorMap[report.summary.riskLevel]}">${report.summary.riskLevel.toUpperCase()}</span></td>
              </tr>
              <tr>
                <td>总检查数</td>
                <td>${report.summary.totalChecks}</td>
              </tr>
              <tr>
                <td>通过</td>
                <td><span class="text-success">${report.summary.passedChecks} ✅</span></td>
              </tr>
              <tr>
                <td>失败</td>
                <td><span class="text-danger">${report.summary.failedChecks} ❌</span></td>
              </tr>
              <tr>
                <td>跳过</td>
                <td><span class="text-secondary">${report.summary.skippedChecks} ⏭️</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="mb-5">
      <h2>📁 扫描结果</h2>
      <p><strong>总文件数:</strong> ${report.scan.summary.totalFiles}</p>
      <table class="table table-sm">
        <thead><tr><th>文件类型</th><th>数量</th></tr></thead>
        <tbody>
          ${Object.entries(report.scan.summary.byType)
            .filter(([, count]) => count > 0)
            .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </section>

    <section class="mb-5">
      <h2>🔍 验证结果</h2>
      <p>
        <strong>扫描文件数:</strong> ${report.validate.scannedFiles} | 
        <strong>总问题数:</strong> ${report.validate.summary.totalIssues} |
        <span class="text-danger">错误: ${report.validate.summary.bySeverity.errors}</span> |
        <span class="text-warning">警告: ${report.validate.summary.bySeverity.warnings}</span>
      </p>
      ${report.validate.issues.length > 0 ? `
        <h3 class="mt-4">问题详情</h3>
        ${report.validate.issues.map(formatIssue).join('')}
      ` : '<p class="text-success">没有发现验证问题！</p>'}
    </section>

    <section class="mb-5">
      <h2>🧪 代码片段执行结果</h2>
      <p>
        <strong>总代码片段:</strong> ${report.runSnippets.summary.totalSnippets} |
        <span class="text-success">通过: ${report.runSnippets.summary.passed}</span> |
        <span class="text-danger">失败: ${report.runSnippets.summary.failed}</span> |
        <span class="text-secondary">跳过: ${report.runSnippets.summary.skipped}</span>
      </p>
      ${Object.keys(report.runSnippets.summary.byLanguage).length > 0 ? `
        <h4>按语言统计</h4>
        <table class="table table-sm mb-4">
          <thead><tr><th>语言</th><th>数量</th></tr></thead>
          <tbody>
            ${Object.entries(report.runSnippets.summary.byLanguage)
              .map(([lang, count]) => `<tr><td>${lang}</td><td>${count}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      ` : ''}
      ${report.runSnippets.issues.length > 0 ? `
        <h3 class="mt-4">执行问题</h3>
        ${report.runSnippets.issues.map(formatIssue).join('')}
      ` : ''}
      ${report.runSnippets.results.length > 0 ? `
        <h3 class="mt-4">执行详情</h3>
        ${report.runSnippets.results.map(formatResult).join('')}
      ` : ''}
    </section>

    <section class="mb-5">
      <h2>🛠️ 修复清单</h2>
      ${report.fixList.length === 0 ? `
        <div class="alert alert-success">没有需要修复的问题！🎉</div>
      ` : `
        <table class="table table-hover">
          <thead>
            <tr>
              <th>优先级</th>
              <th>类型</th>
              <th>位置</th>
              <th>问题</th>
              <th>建议</th>
            </tr>
          </thead>
          <tbody>
            ${report.fixList.map(item => `
              <tr class="table-${item.priority === 'high' ? 'danger' : item.priority === 'medium' ? 'warning' : 'light'}">
                <td>${item.priority === 'high' ? '🔴 高' : item.priority === 'medium' ? '🟡 中' : '🟢 低'}</td>
                <td><code>${item.type}</code></td>
                <td>${item.location.file}:${item.location.line}</td>
                <td>${item.description.substring(0, 60)}</td>
                <td>${item.suggestion.substring(0, 80)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>

    <footer class="text-center text-muted py-4 border-top">
      <p>由 course-checker 生成 | ${new Date().toLocaleDateString('zh-CN')}</p>
    </footer>
  </div>
</body>
</html>
    `;
  }

  async exportReport(): Promise<{ json: string; html: string; markdown: string }> {
    const report = this.generateReport();

    const json = JSON.stringify(report, null, 2);
    const html = this.toHtml(report);
    const markdown = this.toMarkdown(report);

    return { json, html, markdown };
  }

  async writeToFiles(): Promise<{ jsonPath: string; htmlPath: string; markdownPath: string }> {
    const outputDir = this.options.config.report.outputDir;
    const fullOutputDir = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(this.options.rootPath, outputDir);

    await ensureDirAsync(fullOutputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = `course-check-report-${timestamp}`;

    const { json, html, markdown } = await this.exportReport();

    const jsonPath = path.join(fullOutputDir, `${baseFilename}.json`);
    const htmlPath = path.join(fullOutputDir, `${baseFilename}.html`);
    const markdownPath = path.join(fullOutputDir, `${baseFilename}.md`);

    await writeFileAsync(jsonPath, json);
    await writeFileAsync(htmlPath, html);
    await writeFileAsync(markdownPath, markdown);

    return { jsonPath, htmlPath, markdownPath };
  }
}
