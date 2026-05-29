import * as fs from 'fs';
import * as path from 'path';
import { ContractDiffResult, ReportOptions, ApiContract } from './types';
import { SampleGenerator } from './sample-generator';

export class ReportExporter {
  private sampleGenerator: SampleGenerator;

  constructor() {
    this.sampleGenerator = new SampleGenerator();
  }

  export(diff: ContractDiffResult, options: ReportOptions): string {
    let content: string;

    switch (options.format) {
      case 'json':
        content = this.exportJSON(diff, options);
        break;
      case 'html':
        content = this.exportHTML(diff, options);
        break;
      case 'markdown':
        content = this.exportMarkdown(diff, options);
        break;
      default:
        content = this.exportJSON(diff, options);
    }

    if (options.outputPath) {
      this.writeFile(options.outputPath, content);
    }

    return content;
  }

  private exportJSON(diff: ContractDiffResult, options: ReportOptions): string {
    const output: any = {
      summary: diff.summary,
      timestamp: diff.timestamp,
      sources: {
        contractA: {
          version: diff.contractA.version,
          source: diff.contractA.source,
          sourceName: diff.contractA.sourceName
        },
        contractB: {
          version: diff.contractB.version,
          source: diff.contractB.source,
          sourceName: diff.contractB.sourceName
        }
      },
      breakingChanges: this.collectBreakingChanges(diff),
      warnings: this.collectWarnings(diff),
      info: this.collectInfos(diff),
      missingEndpoints: diff.missingEndpoints.map(e => ({
        method: e.method,
        path: e.path,
        summary: e.summary
      })),
      newEndpoints: diff.newEndpoints.map(e => ({
        method: e.method,
        path: e.path,
        summary: e.summary
      }))
    };

    if (options.includeSchema) {
      output.contractA = diff.contractA;
      output.contractB = diff.contractB;
    }

    if (options.includeExamples) {
      output.examples = this.generateExamples(diff.contractB);
    }

    return JSON.stringify(output, null, 2);
  }

  private exportHTML(diff: ContractDiffResult, options: ReportOptions): string {
    const statusColor = diff.summary.isCompatible ? '#22c55e' : '#ef4444';
    const statusText = diff.summary.isCompatible ? '兼容' : '不兼容';

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>接口契约差异报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .status { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: 600; background: ${statusColor}; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px; }
    .summary-card { background: #f1f5f9; border-radius: 8px; padding: 16px; text-align: center; }
    .summary-card .number { font-size: 32px; font-weight: 700; color: #1e293b; }
    .summary-card .label { font-size: 14px; color: #64748b; margin-top: 4px; }
    .section { background: white; border-radius: 8px; padding: 24px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .diff-item { border-left: 3px solid #e2e8f0; padding: 12px 16px; margin-bottom: 8px; background: #f8fafc; border-radius: 0 4px 4px 0; }
    .diff-item.breaking { border-left-color: #ef4444; background: #fef2f2; }
    .diff-item.warning { border-left-color: #f59e0b; background: #fffbeb; }
    .diff-item.info { border-left-color: #3b82f6; background: #eff6ff; }
    .diff-field { font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; color: #1e293b; font-weight: 500; }
    .diff-type { display: inline-block; font-size: 12px; padding: 2px 8px; border-radius: 4px; margin-right: 8px; }
    .diff-type.breaking { background: #fee2e2; color: #dc2626; }
    .diff-type.warning { background: #fef3c7; color: #d97706; }
    .diff-type.info { background: #dbeafe; color: #2563eb; }
    .diff-context { font-size: 13px; color: #64748b; margin-top: 4px; }
    .diff-source { font-size: 12px; color: #94a3b8; margin-top: 4px; font-family: monospace; }
    .endpoint { margin-bottom: 24px; }
    .endpoint-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .method { font-family: monospace; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; background: #e2e8f0; }
    .method.GET { background: #dbeafe; color: #1d4ed8; }
    .method.POST { background: #dcfce7; color: #15803d; }
    .method.PUT { background: #fef3c7; color: #a16207; }
    .method.DELETE { background: #fee2e2; color: #b91c1c; }
    .endpoint-path { font-family: monospace; font-size: 14px; color: #334155; }
    .source-info { display: flex; gap: 20px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .source { font-size: 13px; color: #64748b; }
    .source span { font-weight: 600; color: #334155; }
    pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="font-size: 24px; color: #1e293b; margin-bottom: 8px;">接口契约差异报告</h1>
      <p style="color: #64748b;">生成时间: ${new Date(diff.timestamp).toLocaleString('zh-CN')}</p>
      <div style="margin-top: 16px;">
        <span class="status">${statusText}</span>
      </div>
      <div class="summary">
        <div class="summary-card">
          <div class="number">${diff.summary.totalDiffs}</div>
          <div class="label">总差异</div>
        </div>
        <div class="summary-card">
          <div class="number" style="color: #ef4444;">${diff.summary.breakingChanges}</div>
          <div class="label">破坏性变更</div>
        </div>
        <div class="summary-card">
          <div class="number" style="color: #f59e0b;">${diff.summary.warnings}</div>
          <div class="label">警告</div>
        </div>
        <div class="summary-card">
          <div class="number" style="color: #3b82f6;">${diff.summary.infos}</div>
          <div class="label">提示</div>
        </div>
      </div>
      <div class="source-info">
        <div class="source">
          基准: <span>${diff.contractA.sourceName}</span> (v${diff.contractA.version}, ${diff.contractA.source})
        </div>
        <div class="source">
          目标: <span>${diff.contractB.sourceName}</span> (v${diff.contractB.version}, ${diff.contractB.source})
        </div>
      </div>
    </div>

    ${this.renderHTMLSection('破坏性变更', diff, 'breaking')}
    ${this.renderHTMLSection('警告', diff, 'warning')}
    ${this.renderHTMLSection('提示', diff, 'info')}
    
    ${diff.missingEndpoints.length > 0 ? this.renderHTMLEndpoints('缺失的端点', diff.missingEndpoints, 'breaking') : ''}
    ${diff.newEndpoints.length > 0 ? this.renderHTMLEndpoints('新增的端点', diff.newEndpoints, 'info') : ''}

    ${options.includeExamples ? this.renderHTMLExamples(diff.contractB) : ''}
  </div>
</body>
</html>`;
  }

  private renderHTMLSection(title: string, diff: ContractDiffResult, severity: string): string {
    const filteredDiffs = diff.endpointDiffs.filter(d => 
      d.fieldDiffs.some(f => f.severity === severity)
    );

    if (filteredDiffs.length === 0) {
      return '';
    }

    let html = `<div class="section"><h2 class="section-title">${title}</h2>`;

    for (const endpointDiff of filteredDiffs) {
      const fieldDiffs = endpointDiff.fieldDiffs.filter(f => f.severity === severity);
      if (fieldDiffs.length === 0) continue;

      html += `
        <div class="endpoint">
          <div class="endpoint-header">
            <span class="method ${endpointDiff.method}">${endpointDiff.method}</span>
            <span class="endpoint-path">${endpointDiff.path}</span>
          </div>`;

      for (const fieldDiff of fieldDiffs) {
        html += `
          <div class="diff-item ${severity}">
            <span class="diff-type ${severity}">${this.formatDiffType(fieldDiff.type)}</span>
            <span class="diff-field">${fieldDiff.field}</span>
            ${fieldDiff.expected !== undefined || fieldDiff.actual !== undefined ? 
              `<div class="diff-context">
                ${fieldDiff.expected !== undefined ? `预期: <code>${JSON.stringify(fieldDiff.expected)}</code>` : ''}
                ${fieldDiff.actual !== undefined ? `实际: <code>${JSON.stringify(fieldDiff.actual)}</code>` : ''}
              </div>` : ''}
            ${fieldDiff.source?.context ? `<div class="diff-context">${fieldDiff.source.context}</div>` : ''}
            ${fieldDiff.source?.line ? `<div class="diff-source">来源: 第 ${fieldDiff.source.line} 行</div>` : ''}
          </div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  private renderHTMLEndpoints(title: string, endpoints: any[], severity: string): string {
    let html = `<div class="section"><h2 class="section-title">${title} (${endpoints.length})</h2>`;

    for (const endpoint of endpoints) {
      html += `
        <div class="endpoint">
          <div class="endpoint-header">
            <span class="method ${endpoint.method}">${endpoint.method}</span>
            <span class="endpoint-path">${endpoint.path}</span>
          </div>
          ${endpoint.summary ? `<p style="color: #64748b; font-size: 14px;">${endpoint.summary}</p>` : ''}
        </div>`;
    }

    html += `</div>`;
    return html;
  }

  private renderHTMLExamples(contract: ApiContract): string {
    const examples = this.sampleGenerator.generateContractExamples(contract);
    
    let html = `<div class="section"><h2 class="section-title">响应样例</h2>`;

    for (const example of examples.slice(0, 5)) {
      html += `
        <div class="endpoint">
          <div class="endpoint-header">
            <span class="method ${example.method}">${example.method}</span>
            <span class="endpoint-path">${example.path}</span>
          </div>`;

      for (const [status, body] of Object.entries(example.examples.responses)) {
        html += `
          <div style="margin-top: 8px;">
            <div style="font-size: 13px; color: #64748b; margin-bottom: 4px;">响应 ${status}:</div>
            <pre>${JSON.stringify(body, null, 2)}</pre>
          </div>`;
      }

      html += `</div>`;
    }

    html += `</div>`;
    return html;
  }

  private exportMarkdown(diff: ContractDiffResult, options: ReportOptions): string {
    const status = diff.summary.isCompatible ? '✅ 兼容' : '❌ 不兼容';

    let md = `# 接口契约差异报告\n\n`;
    md += `生成时间: ${new Date(diff.timestamp).toLocaleString('zh-CN')}\n\n`;
    md += `## 概要\n\n`;
    md += `状态: ${status}\n\n`;
    md += `| 指标 | 数量 |\n`;
    md += `|------|------|\n`;
    md += `| 总差异 | ${diff.summary.totalDiffs} |\n`;
    md += `| 破坏性变更 | ${diff.summary.breakingChanges} 🔴 |\n`;
    md += `| 警告 | ${diff.summary.warnings} 🟡 |\n`;
    md += `| 提示 | ${diff.summary.infos} 🔵 |\n\n`;
    md += `### 来源\n\n`;
    md += `- **基准**: ${diff.contractA.sourceName} (v${diff.contractA.version}, ${diff.contractA.source})\n`;
    md += `- **目标**: ${diff.contractB.sourceName} (v${diff.contractB.version}, ${diff.contractB.source})\n\n`;

    const breaking = this.collectBreakingChanges(diff);
    if (breaking.length > 0) {
      md += `## 🔴 破坏性变更 (${breaking.length})\n\n`;
      for (const item of breaking) {
        md += `- **${item.field}**\n`;
        md += `  - 类型: ${this.formatDiffType(item.type)}\n`;
        if (item.expected !== undefined) md += `  - 预期: \`${JSON.stringify(item.expected)}\`\n`;
        if (item.actual !== undefined) md += `  - 实际: \`${JSON.stringify(item.actual)}\`\n`;
        if (item.source?.context) md += `  - 上下文: ${item.source.context}\n`;
        if (item.source?.line) md += `  - 行号: ${item.source.line}\n`;
        md += `\n`;
      }
    }

    const warnings = this.collectWarnings(diff);
    if (warnings.length > 0) {
      md += `## 🟡 警告 (${warnings.length})\n\n`;
      for (const item of warnings) {
        md += `- **${item.field}**\n`;
        md += `  - 类型: ${this.formatDiffType(item.type)}\n`;
        if (item.source?.context) md += `  - 上下文: ${item.source.context}\n`;
        md += `\n`;
      }
    }

    if (diff.missingEndpoints.length > 0) {
      md += `## 缺失的端点 (${diff.missingEndpoints.length})\n\n`;
      for (const e of diff.missingEndpoints) {
        md += `- \`${e.method}\` ${e.path}${e.summary ? ` - ${e.summary}` : ''}\n`;
      }
      md += `\n`;
    }

    if (diff.newEndpoints.length > 0) {
      md += `## 新增的端点 (${diff.newEndpoints.length})\n\n`;
      for (const e of diff.newEndpoints) {
        md += `- \`${e.method}\` ${e.path}${e.summary ? ` - ${e.summary}` : ''}\n`;
      }
      md += `\n`;
    }

    if (options.includeExamples) {
      md += `## 响应样例\n\n`;
      const examples = this.sampleGenerator.generateContractExamples(diff.contractB);
      for (const example of examples.slice(0, 3)) {
        md += `### ${example.method} ${example.path}\n\n`;
        for (const [status, body] of Object.entries(example.examples.responses)) {
          md += `响应 ${status}:\n\n`;
          md += `\`\`\`json\n${JSON.stringify(body, null, 2)}\n\`\`\`\n\n`;
        }
      }
    }

    return md;
  }

  private collectBreakingChanges(diff: ContractDiffResult): any[] {
    const result: any[] = [];
    for (const e of diff.endpointDiffs) {
      for (const f of e.fieldDiffs) {
        if (f.severity === 'breaking') {
          result.push({ ...f, endpoint: `${e.method} ${e.path}` });
        }
      }
    }
    return result;
  }

  private collectWarnings(diff: ContractDiffResult): any[] {
    const result: any[] = [];
    for (const e of diff.endpointDiffs) {
      for (const f of e.fieldDiffs) {
        if (f.severity === 'warning') {
          result.push({ ...f, endpoint: `${e.method} ${e.path}` });
        }
      }
    }
    return result;
  }

  private collectInfos(diff: ContractDiffResult): any[] {
    const result: any[] = [];
    for (const e of diff.endpointDiffs) {
      for (const f of e.fieldDiffs) {
        if (f.severity === 'info') {
          result.push({ ...f, endpoint: `${e.method} ${e.path}` });
        }
      }
    }
    return result;
  }

  private formatDiffType(type: string): string {
    const map: Record<string, string> = {
      type_changed: '类型变更',
      field_added: '新增字段',
      field_removed: '移除字段',
      nullable_changed: '可空性变更',
      required_changed: '必填性变更',
      enum_added: '新增枚举',
      enum_removed: '移除枚举',
      endpoint_added: '新增端点',
      endpoint_removed: '移除端点',
      parameter_added: '新增参数',
      parameter_removed: '移除参数',
      response_code_added: '新增响应码',
      response_code_removed: '移除响应码'
    };
    return map[type] || type;
  }

  private generateExamples(contract: ApiContract): any {
    return this.sampleGenerator.generateContractExamples(contract);
  }

  private writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
