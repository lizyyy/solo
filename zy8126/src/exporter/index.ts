import * as fs from 'fs';
import * as path from 'path';
import {
  RenderedReceipt,
  ValidationResult,
  ValidationIssue,
  ExportResult,
} from '../types';

export class Exporter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.promises.access(this.outputDir);
    } catch {
      await fs.promises.mkdir(this.outputDir, { recursive: true });
    }
  }

  async exportPreview(receipts: RenderedReceipt[]): Promise<string> {
    await this.ensureOutputDir();
    
    let content = '';
    const timestamp = new Date().toISOString();
    
    content += `================================================================================\n`;
    content += `                          票据版式回放器 - 预览报告\n`;
    content += `                          生成时间: ${timestamp}\n`;
    content += `================================================================================\n\n`;

    for (const receipt of receipts) {
      content += `--------------------------------------------------------------------------------\n`;
      content += `  模板: ${receipt.templateName}\n`;
      content += `  交易ID: ${receipt.transactionId}\n`;
      content += `  纸宽: ${receipt.paperWidth}mm (每行 ${receipt.charsPerLine} 字符)\n`;
      content += `  总行数: ${receipt.totalLines}\n`;
      content += `--------------------------------------------------------------------------------\n\n`;

      for (let i = 0; i < receipt.lines.length; i++) {
        const line = receipt.lines[i];
        const lineNum = String(i + 1).padStart(3, '0');
        content += `[${lineNum}] ${line.text}\n`;
      }

      content += `\n  纸宽标记: ${"+".repeat(receipt.charsPerLine)}\n\n`;
    }

    const filePath = path.join(this.outputDir, 'preview.txt');
    await fs.promises.writeFile(filePath, content, 'utf-8');
    
    return filePath;
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async exportIssues(results: ValidationResult[]): Promise<string> {
    await this.ensureOutputDir();

    const allIssues: ValidationIssue[] = [];
    for (const result of results) {
      allIssues.push(...result.issues);
    }

    const headers = [
      'ID',
      '类型',
      '严重程度',
      '消息',
      '模板名称',
      '交易ID',
      '元素索引',
      '行号',
      '字段',
      '期望值',
      '实际值',
    ];

    let content = headers.map(h => this.escapeCSV(h)).join(',') + '\n';

    for (const issue of allIssues) {
      const row = [
        issue.id,
        issue.type,
        issue.severity,
        issue.message,
        issue.templateName || '',
        issue.transactionId || '',
        issue.elementIndex !== undefined ? String(issue.elementIndex) : '',
        issue.lineNumber !== undefined ? String(issue.lineNumber) : '',
        issue.field || '',
        issue.expected || '',
        issue.actual || '',
      ];
      content += row.map(cell => this.escapeCSV(cell)).join(',') + '\n';
    }

    const filePath = path.join(this.outputDir, 'issues.csv');
    await fs.promises.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  async exportReport(
    receipts: RenderedReceipt[],
    results: ValidationResult[]
  ): Promise<string> {
    await this.ensureOutputDir();

    const timestamp = new Date().toISOString();
    const allIssues: ValidationIssue[] = [];
    for (const result of results) {
      allIssues.push(...result.issues);
    }

    const totalErrors = allIssues.filter(i => i.severity === 'error').length;
    const totalWarnings = allIssues.filter(i => i.severity === 'warning').length;
    const totalInfos = allIssues.filter(i => i.severity === 'info').length;

    let content = `# 票据版式回放器 - 检查报告\n\n`;
    content += `> 生成时间: ${timestamp}\n\n`;

    content += `## 摘要\n\n`;
    content += `| 指标 | 数值 |\n`;
    content += `|------|------|\n`;
    content += `| 处理票据数 | ${receipts.length} |\n`;
    content += `| 问题总数 | ${allIssues.length} |\n`;
    content += `| 错误数 | ${totalErrors} |\n`;
    content += `| 警告数 | ${totalWarnings} |\n`;
    content += `| 提示数 | ${totalInfos} |\n\n`;

    if (allIssues.length > 0) {
      content += `## 问题统计\n\n`;

      const issueTypes = new Map<string, number>();
      for (const issue of allIssues) {
        const count = issueTypes.get(issue.type) || 0;
        issueTypes.set(issue.type, count + 1);
      }

      content += `### 按类型统计\n\n`;
      content += `| 问题类型 | 数量 |\n`;
      content += `|----------|------|\n`;
      for (const [type, count] of issueTypes.entries()) {
        content += `| ${type} | ${count} |\n`;
      }
      content += `\n`;

      content += `### 详细问题列表\n\n`;

      const errors = allIssues.filter(i => i.severity === 'error');
      const warnings = allIssues.filter(i => i.severity === 'warning');
      const infos = allIssues.filter(i => i.severity === 'info');

      if (errors.length > 0) {
        content += `#### 错误 (${errors.length})\n\n`;
        for (const issue of errors) {
          content += `- **[${issue.id}]** ${issue.message}\n`;
          if (issue.templateName) content += `  - 模板: ${issue.templateName}\n`;
          if (issue.transactionId) content += `  - 交易ID: ${issue.transactionId}\n`;
          if (issue.field) content += `  - 字段: ${issue.field}\n`;
          if (issue.expected) content += `  - 期望: ${issue.expected}\n`;
          if (issue.actual) content += `  - 实际: ${issue.actual}\n`;
          content += `\n`;
        }
      }

      if (warnings.length > 0) {
        content += `#### 警告 (${warnings.length})\n\n`;
        for (const issue of warnings) {
          content += `- **[${issue.id}]** ${issue.message}\n`;
          if (issue.templateName) content += `  - 模板: ${issue.templateName}\n`;
          if (issue.transactionId) content += `  - 交易ID: ${issue.transactionId}\n`;
          if (issue.field) content += `  - 字段: ${issue.field}\n`;
          content += `\n`;
        }
      }

      if (infos.length > 0) {
        content += `#### 提示 (${infos.length})\n\n`;
        for (const issue of infos) {
          content += `- **[${issue.id}]** ${issue.message}\n`;
          content += `\n`;
        }
      }
    } else {
      content += `## 检查结果\n\n`;
      content += `✅ 所有检查通过，未发现问题。\n\n`;
    }

    content += `## 票据预览摘要\n\n`;
    for (const receipt of receipts) {
      content += `### ${receipt.templateName} - ${receipt.transactionId}\n\n`;
      content += `- 纸宽: ${receipt.paperWidth}mm\n`;
      content += `- 每行字符数: ${receipt.charsPerLine}\n`;
      content += `- 总行数: ${receipt.totalLines}\n`;
      content += `- 最大视觉宽度: ${receipt.totalVisualWidth}\n`;
      content += `\n`;
    }

    const filePath = path.join(this.outputDir, 'report.md');
    await fs.promises.writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  async exportAll(
    receipts: RenderedReceipt[],
    results: ValidationResult[]
  ): Promise<ExportResult> {
    const previewFile = await this.exportPreview(receipts);
    const issuesFile = await this.exportIssues(results);
    const reportFile = await this.exportReport(receipts, results);

    const allIssues: ValidationIssue[] = [];
    for (const result of results) {
      allIssues.push(...result.issues);
    }

    const totalErrors = allIssues.filter(i => i.severity === 'error').length;
    const totalWarnings = allIssues.filter(i => i.severity === 'warning').length;

    return {
      previewFile,
      issuesFile,
      reportFile,
      timestamp: new Date().toISOString(),
      summary: {
        totalReceipts: receipts.length,
        totalIssues: allIssues.length,
        errors: totalErrors,
        warnings: totalWarnings,
      },
    };
  }
}
