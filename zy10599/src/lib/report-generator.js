import fs from 'fs/promises';
import path from 'path';

export class ReportGenerator {
  constructor(checker, outputDir = './reports') {
    this.checker = checker;
    this.outputDir = outputDir;
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  }

  async generate() {
    await fs.mkdir(this.outputDir, { recursive: true });

    const summary = this.checker.getSummary();
    const results = this.checker.results;
    
    const reportData = {
      meta: {
        generatedAt: new Date().toISOString(),
        timestamp: this.timestamp,
        openapiPath: this.checker.openapiPath,
        mockPath: this.checker.mockPath,
        options: this.checker.options
      },
      summary,
      breakdown: {
        normal: this.getNormalResults(results),
        risks: this.getRiskResults(results),
        unprocessable: this.getUnprocessableResults(results)
      },
      details: results
    };

    const jsonPath = await this.writeJsonReport(reportData);
    const markdownPath = await this.writeMarkdownReport(reportData);

    return {
      jsonPath,
      markdownPath,
      reportData
    };
  }

  getNormalResults(results) {
    return results.filter(r => r.status === 'pass').map(r => ({
      file: r.file,
      fileName: r.fileName,
      method: r.method,
      path: r.path,
      statusCode: r.statusCode,
      contractFields: r.contractFields,
      mockFields: r.mockFields,
      endpointSummary: r.matchedEndpoint?.summary
    }));
  }

  getRiskResults(results) {
    return results
      .filter(r => ['fail', 'warn'].includes(r.status))
      .map(r => ({
        file: r.file,
        fileName: r.fileName,
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        status: r.status,
        issues: r.issues,
        summary: r.summary,
        endpointSummary: r.matchedEndpoint?.summary
      }));
  }

  getUnprocessableResults(results) {
    return results
      .filter(r => ['unmatched', 'error', 'no_schema'].includes(r.status))
      .map(r => ({
        file: r.file,
        fileName: r.fileName,
        method: r.method,
        path: r.path,
        status: r.status,
        message: r.message || r.error
      }));
  }

  async writeJsonReport(reportData) {
    const filename = `mock-consistency-report-${this.timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(reportData, null, 2), 'utf-8');
    
    return filepath;
  }

  async writeMarkdownReport(reportData) {
    const filename = `mock-consistency-report-${this.timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);
    
    const content = this.generateMarkdownContent(reportData);
    await fs.writeFile(filepath, content, 'utf-8');
    
    return filepath;
  }

  generateMarkdownContent(reportData) {
    const { meta, summary, breakdown } = reportData;
    
    return `# Mock 数据与 OpenAPI 契约一致性检查报告

> 生成时间: ${meta.generatedAt}

## 概览

| 指标 | 数量 |
|------|------|
| 检查的 Mock 文件 | ${summary.total} |
| ✅ 通过 | ${summary.passed} |
| ❌ 失败 | ${summary.failed} |
| ⚠️ 警告 | ${summary.warned} |
| ❓ 未匹配 | ${summary.unmatched} |
| 🔴 解析错误 | ${summary.errors} |
| 📭 无 Schema | ${summary.noSchema} |
| 总问题数 | ${summary.totalIssues} |
| - 错误 | ${summary.totalErrors} |
| - 警告 | ${summary.totalWarnings} |
| 通过率 | ${summary.passRate}% |

---

## ✅ 正常项 (${breakdown.normal.length})

${breakdown.normal.length > 0 ? this.renderNormalTable(breakdown.normal) : '*无*'}

---

## ⚠️ 风险项 (${breakdown.risks.length})

${breakdown.risks.length > 0 ? this.renderRisks(breakdown.risks) : '*无*'}

---

## ❌ 无法处理的样本 (${breakdown.unprocessable.length})

${breakdown.unprocessable.length > 0 ? this.renderUnprocessable(breakdown.unprocessable) : '*无*'}

---

## 检查配置

- OpenAPI 契约: \`${meta.openapiPath}\`
- Mock 路径: \`${meta.mockPath}\`
- 严格类型检查: ${meta.options.strictType ? '✅' : '❌'}
- 检查可选字段: ${meta.options.checkOptional ? '✅' : '❌'}

---

*此报告由 mock-contract-checker 自动生成*
`;
  }

  renderNormalTable(normal) {
    const rows = normal.map(n => 
      `| ${n.fileName} | ${n.method} | \`${n.path}\` | ${n.statusCode} | ${n.contractFields}/${n.mockFields} |`
    ).join('\n');

    return `| 文件 | 方法 | 路径 | 状态码 | 字段数(契约/Mock) |
|------|------|------|--------|-------------------|
${rows}
`;
  }

  renderRisks(risks) {
    return risks.map(risk => {
      const statusIcon = risk.status === 'fail' ? '❌' : '⚠️';
      const issuesBySeverity = {
        error: risk.issues.filter(i => i.severity === 'error'),
        warning: risk.issues.filter(i => i.severity === 'warning')
      };

      return `### ${statusIcon} ${risk.fileName}

- **方法**: ${risk.method}
- **路径**: \`${risk.path}\`
- **状态码**: ${risk.statusCode}
- **问题统计**: ${risk.summary?.errors || 0} 错误, ${risk.summary?.warnings || 0} 警告

${issuesBySeverity.error.length > 0 ? `#### ❌ 错误 (${issuesBySeverity.error.length})

${this.renderIssues(issuesBySeverity.error)}` : ''}

${issuesBySeverity.warning.length > 0 ? `#### ⚠️ 警告 (${issuesBySeverity.warning.length})

${this.renderIssues(issuesBySeverity.warning)}` : ''}

---`;
    }).join('\n\n');
  }

  renderIssues(issues) {
    const typeLabels = {
      missing_field: '字段缺失',
      type_mismatch: '类型不匹配',
      extra_field: '额外字段',
      invalid_enum: '枚举值无效'
    };

    return issues.map(issue => {
      const label = typeLabels[issue.type] || issue.type;
      let details = '';

      if (issue.type === 'missing_field') {
        details = `  - 期望类型: \`${issue.expected.type}\``;
        if (issue.expected.description) {
          details += `\n  - 描述: ${issue.expected.description}`;
        }
      } else if (issue.type === 'type_mismatch') {
        details = `  - 期望: \`${issue.expected}\`, 实际: \`${issue.actual}\``;
        if (issue.sampleValue !== undefined) {
          details += `\n  - 样例值: \`${JSON.stringify(issue.sampleValue)}\``;
        }
      } else if (issue.type === 'extra_field') {
        details = `  - 实际类型: \`${issue.actual.type}\``;
      } else if (issue.type === 'invalid_enum') {
        details = `  - 允许值: [${issue.expected.join(', ')}]`;
        details += `\n  - 实际值: \`${issue.actual}\``;
      }

      return `**${label}**: \`${issue.path}\`
${details}`;
    }).join('\n\n');
  }

  renderUnprocessable(unprocessable) {
    const statusLabels = {
      unmatched: '未匹配',
      error: '解析错误',
      no_schema: '无 Schema'
    };

    const statusIcons = {
      unmatched: '❓',
      error: '🔴',
      no_schema: '📭'
    };

    const rows = unprocessable.map(u => {
      const label = statusLabels[u.status] || u.status;
      const icon = statusIcons[u.status] || '❓';
      return `| ${u.fileName} | ${icon} ${label} | ${u.message} |`;
    }).join('\n');

    return `| 文件 | 状态 | 原因 |
|------|------|------|
${rows}
`;
  }
}