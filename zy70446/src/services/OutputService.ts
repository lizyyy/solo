import * as fs from 'fs';
import * as path from 'path';
import { AuditRecord, OutputFormat, AuditResult } from '../types';

export class OutputService {
  formatRecord(record: AuditRecord, format: OutputFormat): string {
    if (format === 'json') {
      return JSON.stringify(record, null, 2);
    }
    return this.toMarkdown(record);
  }

  formatRecords(records: AuditRecord[], format: OutputFormat): string {
    if (format === 'json') {
      return JSON.stringify(records, null, 2);
    }
    return this.toMarkdownBatch(records);
  }

  private toMarkdown(record: AuditRecord): string {
    const finalDecision = record.finalDecision || record.result.overallDecision;
    const result = record.result;
    const handler = this.getHandler(record);
    
    let md = `# 审核报告 - ${result.itemId}\n\n`;
    md += `## 基本信息\n\n`;
    md += `- **内容类型**: ${result.item.contentType}\n`;
    md += `- **审核时间**: ${new Date(record.auditTimestamp || result.timestamp).toLocaleString('zh-CN')}\n`;
    md += `- **系统判定**: ${this.decisionEmoji(result.overallDecision)} ${result.overallDecision.toUpperCase()}\n`;
    md += `- **置信度**: ${(result.overallConfidence * 100).toFixed(1)}%\n`;
    md += `- **处理状态**: ${record.status.toUpperCase()}\n`;
    md += `- **最终判定**: ${this.decisionEmoji(finalDecision)} ${finalDecision.toUpperCase()}\n`;
    if (handler) {
      md += `- **审核处理人**: ${handler}\n`;
    }
    md += '\n';

    md += `## 待审核内容\n\n`;
    md += `\`\`\`\n${result.item.content}\n\`\`\`\n\n`;

    md += `## 多模型评测结果\n\n`;
    md += `| 模型名称 | 风险分数 | 标签 | 置信度 |\n`;
    md += `|----------|----------|------|--------|\n`;
    for (const model of result.modelResults) {
      md += `| ${model.modelName} | ${model.score} | ${model.label} | ${(model.confidence * 100).toFixed(1)}% |\n`;
    }
    md += '\n';

    md += `## 规则检测结果\n\n`;
    md += `| 规则ID | 规则名称 | 匹配状态 | 严重度 | 匹配内容 |\n`;
    md += `|--------|----------|----------|--------|----------|\n`;
    for (const rule of result.ruleResults) {
      const matched = rule.matched ? '✓ 匹配' : '✗ 未匹配';
      md += `| ${rule.ruleId} | ${rule.ruleName} | ${matched} | ${rule.severity} | ${rule.matchContent || '-'} |\n`;
    }
    md += '\n';

    if (record.corrections.length > 0) {
      md += `## 人工修正记录\n\n`;
      for (const corr of record.corrections) {
        md += `### 修正 #${corr.id.slice(0, 8)}\n\n`;
        md += `- **处理人**: ${corr.handler}\n`;
        md += `- **原判定**: ${this.decisionEmoji(corr.originalDecision)} ${corr.originalDecision.toUpperCase()}\n`;
        md += `- **新判定**: ${this.decisionEmoji(corr.newDecision)} ${corr.newDecision.toUpperCase()}\n`;
        md += `- **修正时间**: ${new Date(corr.timestamp).toLocaleString('zh-CN')}\n`;
        md += `- **备注**: ${corr.remark}\n\n`;
      }
    }

    md += `## 原始输入溯源\n\n`;
    md += `- **内容哈希**: \`${this.hashContent(result.item.content)}\`\n`;
    if (result.item.metadata) {
      md += `- **元数据**: \n\`\`\`json\n${JSON.stringify(result.item.metadata, null, 2)}\n\`\`\`\n`;
    }

    return md;
  }

  private toMarkdownBatch(records: AuditRecord[]): string {
    let md = `# 批量审核报告\n\n`;
    md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
    md += `**统计汇总**:\n\n`;
    md += `- 总记录数: ${records.length}\n`;
    md += `- 通过(PASS): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'pass').length}\n`;
    md += `- 拒绝(REJECT): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'reject').length}\n`;
    md += `- 待人工审核(REVIEW): ${records.filter(r => (r.finalDecision || r.result.overallDecision) === 'review').length}\n\n`;

    md += `## 审核结果列表\n\n`;
    md += `| 记录ID | 内容预览 | 系统判定 | 最终状态 | 处理人 |\n`;
    md += `|--------|----------|----------|----------|--------|\n`;
    
    for (const record of records) {
      const result = record.result;
      const contentPreview = result.item.content.slice(0, 30) + (result.item.content.length > 30 ? '...' : '');
      const handler = this.getHandler(record);
      md += `| ${result.itemId.slice(0, 12)} | ${contentPreview} | ${this.decisionEmoji(result.overallDecision)} ${result.overallDecision} | ${record.status} | ${handler || '-'} |\n`;
    }
    md += '\n';

    for (const record of records) {
      md += '---\n\n';
      md += this.toMarkdown(record);
    }

    return md;
  }

  private getHandler(record: AuditRecord): string | undefined {
    if (record.handler) {
      return record.handler;
    }
    if (record.corrections.length > 0) {
      return record.corrections[record.corrections.length - 1].handler;
    }
    return undefined;
  }

  private decisionEmoji(decision: string): string {
    switch (decision) {
      case 'pass': return '✅';
      case 'reject': return '❌';
      case 'review': return '⚠️';
      default: return '❓';
    }
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16);
  }

  saveToFile(content: string, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  exportRecords(records: AuditRecord[], format: OutputFormat, outputPath: string): void {
    const content = this.formatRecords(records, format);
    const ext = format === 'json' ? '.json' : '.md';
    const fullPath = outputPath.endsWith(ext) ? outputPath : outputPath + ext;
    this.saveToFile(content, fullPath);
  }
}
