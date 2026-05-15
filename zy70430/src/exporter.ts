import { RequestSizeGuardrail } from './guardrail';
import { ExportReport } from './types';
import * as fs from 'fs-extra';
import * as path from 'path';

export class ReportExporter {
  private guardrail: RequestSizeGuardrail;
  private exportDir: string;

  constructor(guardrail: RequestSizeGuardrail, exportDir: string = './exports') {
    this.guardrail = guardrail;
    this.exportDir = path.resolve(exportDir);
    fs.ensureDirSync(this.exportDir);
  }

  generateReport(generator: string, recordIds?: string[]): ExportReport {
    const records = recordIds
      ? recordIds.map(id => this.guardrail.getRecordById(id)).filter(Boolean) as any
      : this.guardrail.getPendingRecords();

    const report: ExportReport = {
      reportId: `RPT-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      generator,
      records,
      summary: {
        totalRecords: records.length,
        withIssues: records.filter((r: any) => r.fieldIssues.length > 0).length,
        corrected: records.filter((r: any) => r.corrections.length > 0).length,
        pendingReview: records.filter((r: any) => r.status === 'pending').length
      }
    };

    return report;
  }

  exportToJSON(report: ExportReport): string {
    const filePath = path.join(this.exportDir, `${report.reportId}.json`);
    fs.writeJSONSync(filePath, report, { spaces: 2 });
    return filePath;
  }

  exportToMarkdown(report: ExportReport): string {
    const lines: string[] = [];

    lines.push(`# 请求大小护栏复核报告\n`);
    lines.push(`- **报告ID**: ${report.reportId}`);
    lines.push(`- **生成时间**: ${report.generatedAt}`);
    lines.push(`- **生成人**: ${report.generator}`);
    lines.push(``);

    lines.push(`## 汇总统计\n`);
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 总记录数 | ${report.summary.totalRecords} |`);
    lines.push(`| 存在问题 | ${report.summary.withIssues} |`);
    lines.push(`| 已修正 | ${report.summary.corrected} |`);
    lines.push(`| 待复核 | ${report.summary.pendingReview} |`);
    lines.push(``);

    lines.push(`## 记录详情\n`);

    for (const record of report.records) {
      lines.push(`---\n`);
      lines.push(`### ${record.id}\n`);
      lines.push(`- **来源**: ${record.source}`);
      lines.push(`- **类型**: ${record.requestType}`);
      lines.push(`- **时间**: ${record.timestamp}`);
      lines.push(`- **状态**: ${record.status}`);
      lines.push(``);

      if (record.fieldIssues.length > 0) {
        lines.push(`#### 字段问题\n`);
        for (const issue of record.fieldIssues) {
          lines.push(`- **[${issue.fieldPath}]**`);
          lines.push(`  - 问题类型: ${issue.issueType}`);
          lines.push(`  - 严重程度: ${issue.severity}`);
          lines.push(`  - 最大长度: ${issue.maxLength} 字节`);
          lines.push(`  - 实际长度: ${issue.actualLength} 字节`);
          lines.push(`  - 原始值预览: "${issue.originalValue.slice(0, 100)}${issue.originalValue.length > 100 ? '...' : ''}"`);
          if (issue.truncatedValue) {
            lines.push(`  - 截断值预览: "${issue.truncatedValue}"`);
          }
          lines.push(``);
        }
      }

      if (record.corrections.length > 0) {
        lines.push(`#### 人工修正\n`);
        for (const corr of record.corrections) {
          lines.push(`- **修正ID**: ${corr.id}`);
          lines.push(`  - **字段路径**: ${corr.fieldPath}`);
          lines.push(`  - **操作人**: ${corr.operator}`);
          lines.push(`  - **时间**: ${corr.timestamp}`);
          lines.push(`  - **原判断**: ${corr.originalDecision}`);
          lines.push(`  - **修正后**: ${corr.correctedDecision}`);
          lines.push(`  - **修正理由**: ${corr.reason}`);
          if (corr.evidence) {
            lines.push(`  - **依据**: ${corr.evidence}`);
          }
          lines.push(``);
        }
      }

      lines.push(`#### 原始输入溯源\n`);
      this.printNestedValue(record.originalInput, '', lines);
      lines.push(``);
    }

    const content = lines.join('\n');
    const filePath = path.join(this.exportDir, `${report.reportId}.md`);
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  }

  private printNestedValue(obj: any, prefix: string, lines: string[]): void {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              this.printNestedValue(item, `${fieldPath}[${index}]`, lines);
            } else {
              lines.push(`- [${fieldPath}[${index}]]: ${this.formatValue(item)}`);
            }
          });
        } else {
          this.printNestedValue(value, fieldPath, lines);
        }
      } else {
        lines.push(`- [${fieldPath}]: ${this.formatValue(value)}`);
      }
    }
  }

  private formatValue(value: any): string {
    if (typeof value === 'string') {
      const preview = value.slice(0, 80);
      return value.length > 80 ? `"${preview}..." (共${value.length}字符)` : `"${preview}"`;
    }
    return String(value);
  }

  async exportForReview(generator: string): Promise<{ jsonPath: string; mdPath: string }> {
    const report = this.generateReport(generator);
    const jsonPath = this.exportToJSON(report);
    const mdPath = this.exportToMarkdown(report);
    return { jsonPath, mdPath };
  }
}

if (require.main === module) {
  const guardrail = new RequestSizeGuardrail();
  const exporter = new ReportExporter(guardrail);

  exporter.exportForReview('system').then(paths => {
    console.log('导出完成:');
    console.log('JSON:', paths.jsonPath);
    console.log('Markdown:', paths.mdPath);
  });
}
