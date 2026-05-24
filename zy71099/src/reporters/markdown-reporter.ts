import { DiffResult, InteractionDiff, DiffType } from '../types';
import { BaseReporter } from './base-reporter';

const diffTypeLabels: Record<DiffType, string> = {
  request_missing: '请求缺失',
  request_added: '新增请求',
  request_method: '方法不匹配',
  request_url: 'URL不匹配',
  request_header: '请求头差异',
  request_body: '请求体差异',
  request_query: '查询参数差异',
  response_status: '状态码差异',
  response_header: '响应头差异',
  response_body: '响应体差异',
  masking_mismatch: '脱敏问题',
  unmatched: '未匹配'
};

const severityLabels: Record<string, string> = {
  error: '🔴 错误',
  warning: '🟡 警告',
  info: '🔵 信息'
};

export class MarkdownReporter extends BaseReporter {
  generate(): string {
    const lines: string[] = [];

    lines.push(this.generateHeader());
    lines.push('');
    lines.push(this.generateSummary());
    lines.push('');
    
    if (this.result.differences.length > 0) {
      lines.push(this.generateDifferences());
      lines.push('');
    }

    lines.push(this.generateExitCodeInfo());
    lines.push('');
    lines.push(this.generateConfigInfo());

    return lines.join('\n');
  }

  private generateHeader(): string {
    return `# API Cassette 差异报告

**生成时间**: ${new Date(this.result.generatedAt).toLocaleString('zh-CN')}
**比较文件**:
- 期望: \`${this.getRelativePath(this.expectedFile)}\`
- 实际: \`${this.getRelativePath(this.actualFile)}\`
`;
  }

  private generateSummary(): string {
    const { summary } = this.result;

    let statusIcon = '✅';
    let statusText = '通过';
    if (summary.errors > 0) {
      statusIcon = '❌';
      statusText = '失败';
    } else if (summary.warnings > 0) {
      statusIcon = '⚠️';
      statusText = '有警告';
    }

    return `## 比较摘要

**状态**: ${statusIcon} ${statusText}

| 指标 | 数值 |
|------|------|
| 期望请求数 | ${summary.totalInteractions.expected} |
| 实际请求数 | ${summary.totalInteractions.actual} |
| 匹配成功 | ${summary.matched} |
| 新增请求 | ${summary.added} |
| 缺失请求 | ${summary.removed} |
| 内容变更 | ${summary.changed} |
| **错误** | **${summary.errors}** |
| **警告** | **${summary.warnings}** |
`;
  }

  private generateDifferences(): string {
    const lines: string[] = [];
    lines.push('## 差异详情');
    lines.push('');

    const grouped = this.groupBySeverity();
    
    for (const [severity, diffs] of Object.entries(grouped)) {
      if (diffs.length === 0) continue;
      
      lines.push(`### ${severityLabels[severity] || severity} (${diffs.length})`);
      lines.push('');
      
      for (const diff of diffs) {
        lines.push(this.formatDiff(diff));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private groupBySeverity(): Record<string, InteractionDiff[]> {
    const groups: Record<string, InteractionDiff[]> = {
      error: [],
      warning: [],
      info: []
    };

    for (const diff of this.result.differences) {
      groups[diff.severity].push(diff);
    }

    return groups;
  }

  private formatDiff(diff: InteractionDiff): string {
    const typeLabel = diffTypeLabels[diff.type] || diff.type;
    const lines: string[] = [];

    lines.push(`#### ${typeLabel}`);
    lines.push('');
    lines.push(`**描述**: ${diff.message}`);
    lines.push('');

    const sourceLines: string[] = [];
    if (diff.expectedSource?.file) {
      sourceLines.push(`- 期望: \`${this.formatSourceLink(
        diff.expectedSource.file,
        diff.expectedSource.line
      )}\``);
    }
    if (diff.actualSource?.file) {
      sourceLines.push(`- 实际: \`${this.formatSourceLink(
        diff.actualSource.file,
        diff.actualSource.line
      )}\``);
    }

    if (sourceLines.length > 0) {
      lines.push('**源代码位置**:');
      lines.push('');
      lines.push(...sourceLines);
      lines.push('');
    }

    if (diff.details.length > 0) {
      lines.push('<details>');
      lines.push(`<summary>查看 ${diff.details.length} 项详细差异</summary>`);
      lines.push('');
      lines.push('| 路径 | 类型 | 期望值 | 实际值 |');
      lines.push('|------|------|--------|--------|');
      
      for (const detail of diff.details) {
        const typeLabel = detail.type === 'added' ? '新增' : 
                          detail.type === 'removed' ? '删除' : '变更';
        const expected = this.formatValue(detail.expected);
        const actual = this.formatValue(detail.actual);
        lines.push(`| \`${detail.path}\` | ${typeLabel} | ${expected} | ${actual} |`);
      }
      
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatValue(value: any): string {
    if (value === undefined) return '*(不存在)*';
    if (value === null) return '`null`';
    if (typeof value === 'string') {
      const escaped = value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      return escaped.length > 100 ? `\`${escaped.substring(0, 97)}...\`` : `\`${escaped}\``;
    }
    try {
      const str = JSON.stringify(value);
      return str.length > 100 ? `\`${str.substring(0, 97)}...\`` : `\`${str}\``;
    } catch {
      return '*(复杂对象)*';
    }
  }

  private generateExitCodeInfo(): string {
    const explanation = this.getExitCodeExplanation();

    return `## 退出码信息

| 字段 | 值 |
|------|----|
| 退出码 | \`${explanation.code}\` |
| 名称 | \`${explanation.name}\` |
| 说明 | ${explanation.description} |
| 建议 | ${explanation.action} |
`;
  }

  private generateConfigInfo(): string {
    const { config } = this.result;

    return `## 配置信息

<details>
<summary>查看比较配置</summary>

\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`

</details>
`;
  }

  getFileName(): string {
    return 'cassette-diff.md';
  }
}
