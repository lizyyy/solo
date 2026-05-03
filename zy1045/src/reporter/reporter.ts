import * as path from 'path';
import { 
  MaskingSummary, 
  ReportOptions, 
  RiskItem,
  FileProcessingResult
} from '../types';

export class Reporter {
  static generateReport(
    summary: MaskingSummary,
    options: ReportOptions,
    risks?: RiskItem[]
  ): string {
    if (options.format === 'json') {
      return this.generateJsonReport(summary, options, risks);
    }
    return this.generateMarkdownReport(summary, options, risks);
  }

  private static generateMarkdownReport(
    summary: MaskingSummary,
    options: ReportOptions,
    risks?: RiskItem[]
  ): string {
    const lines: string[] = [];

    lines.push('# 数据脱敏交付报告');
    lines.push('');
    lines.push(`**生成时间**: ${summary.timestamp}`);
    lines.push(`**配置文件**: ${summary.configFile}`);
    lines.push(`**执行模式**: ${summary.dryRun ? '预览模式 (Dry Run)' : '实际执行'}`);
    lines.push(`**Salt**: ${summary.salt.substring(0, 8)}...`);
    lines.push('');

    lines.push('## 处理概览');
    lines.push('');
    lines.push('| 指标 | 数值 |');
    lines.push('|------|------|');
    lines.push(`| 处理文件数 | ${summary.totalFiles} |`);
    lines.push(`| 总记录数 | ${summary.totalRecords} |`);
    lines.push(`| 脱敏字段总数 | ${summary.totalMaskedFields} |`);
    lines.push('');

    lines.push('## 各类型脱敏统计');
    lines.push('');
    lines.push('| 字段类型 | 唯一值数量 | 出现次数 |');
    lines.push('|----------|------------|----------|');
    
    const mappingStats = summary.mappingStats || {};
    for (const [type, count] of Object.entries(mappingStats)) {
      const typeName = this.getTypeName(type);
      lines.push(`| ${typeName} | ${count} | - |`);
    }
    lines.push('');

    lines.push('## 文件处理详情');
    lines.push('');

    for (const fileResult of summary.files) {
      const fileName = path.basename(fileResult.filePath);
      lines.push(`### 📄 ${fileName}`);
      lines.push('');
      lines.push(`- **源文件**: ${fileResult.filePath}`);
      lines.push(`- **输出文件**: ${fileResult.outputPath}`);
      lines.push(`- **处理记录数**: ${fileResult.totalRecords}`);
      lines.push('');

      if (Object.keys(fileResult.maskedFields).length > 0) {
        lines.push('**脱敏字段统计:**');
        lines.push('');
        lines.push('| 字段名 | 脱敏数量 |');
        lines.push('|--------|----------|');
        
        for (const [field, count] of Object.entries(fileResult.maskedFields)) {
          lines.push(`| ${field} | ${count} |`);
        }
        lines.push('');
      }

      if (fileResult.warnings.length > 0) {
        lines.push('**⚠️ 警告:**');
        for (const warning of fileResult.warnings) {
          lines.push(`- ${warning}`);
        }
        lines.push('');
      }

      if (fileResult.errors.length > 0) {
        lines.push('**❌ 错误:**');
        for (const error of fileResult.errors) {
          lines.push(`- ${error}`);
        }
        lines.push('');
      }
    }

    if (risks && risks.length > 0) {
      lines.push('## ⚠️ 风险检查结果');
      lines.push('');

      const highRisks = risks.filter(r => r.level === 'high');
      const mediumRisks = risks.filter(r => r.level === 'medium');
      const lowRisks = risks.filter(r => r.level === 'low');

      lines.push(`- **高风险**: ${highRisks.length} 项`);
      lines.push(`- **中风险**: ${mediumRisks.length} 项`);
      lines.push(`- **低风险**: ${lowRisks.length} 项`);
      lines.push('');

      if (highRisks.length > 0) {
        lines.push('### 🔴 高风险');
        lines.push('');
        for (const risk of highRisks) {
          lines.push(`#### ${risk.category.toUpperCase()}`);
          lines.push(`**问题**: ${risk.message}`);
          if (risk.file) lines.push(`**文件**: ${risk.file}`);
          if (risk.field) lines.push(`**字段**: ${risk.field}`);
          if (risk.suggestion) lines.push(`**建议**: ${risk.suggestion}`);
          lines.push('');
        }
      }

      if (mediumRisks.length > 0) {
        lines.push('### 🟡 中风险');
        lines.push('');
        for (const risk of mediumRisks) {
          lines.push(`- **[${risk.category}]** ${risk.message}`);
          if (risk.suggestion) {
            lines.push(`  > 建议: ${risk.suggestion}`);
          }
          lines.push('');
        }
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由 data-masker 工具自动生成*');

    return lines.join('\n');
  }

  private static generateJsonReport(
    summary: MaskingSummary,
    options: ReportOptions,
    risks?: RiskItem[]
  ): string {
    const report = {
      metadata: {
        generatedAt: summary.timestamp,
        configFile: summary.configFile,
        dryRun: summary.dryRun,
        salt: summary.salt,
      },
      summary: {
        totalFiles: summary.totalFiles,
        totalRecords: summary.totalRecords,
        totalMaskedFields: summary.totalMaskedFields,
        mappingStats: summary.mappingStats,
      },
      files: summary.files.map((f: FileProcessingResult) => ({
        source: f.filePath,
        output: f.outputPath,
        recordCount: f.totalRecords,
        maskedFields: f.maskedFields,
        warnings: f.warnings,
        errors: f.errors,
      })),
      risks: risks ? this.summarizeRisksJson(risks) : undefined,
    };

    return JSON.stringify(report, null, 2);
  }

  private static summarizeRisksJson(risks: RiskItem[]): any {
    const high = risks.filter(r => r.level === 'high');
    const medium = risks.filter(r => r.level === 'medium');
    const low = risks.filter(r => r.level === 'low');

    return {
      summary: {
        high: high.length,
        medium: medium.length,
        low: low.length,
      },
      details: risks,
    };
  }

  private static getTypeName(type: string): string {
    const typeNames: { [key: string]: string } = {
      phone: '手机号',
      email: '邮箱',
      name: '姓名',
      address: '地址',
      order_number: '订单号',
      ticket_number: '工单号',
      free_text: '自由文本',
    };
    return typeNames[type] || type;
  }

  static generateMappingReport(mappingStats: any, options: ReportOptions): string {
    if (options.format === 'json') {
      return JSON.stringify(mappingStats, null, 2);
    }

    const lines: string[] = [];
    lines.push('# 映射关系详情');
    lines.push('');

    for (const [type, typeData] of Object.entries(mappingStats)) {
      const data = typeData as any;
      const typeName = this.getTypeName(type);
      
      lines.push(`## ${typeName}`);
      lines.push('');
      lines.push(`- **唯一值数量**: ${data.totalUnique}`);
      lines.push(`- **总出现次数**: ${data.totalOccurrences}`);
      lines.push('');

      if (options.includeMappingDetails && data.mappings) {
        lines.push('### 映射详情');
        lines.push('');
        lines.push('| 原始值 | 脱敏后值 | 出现次数 | 出现文件 |');
        lines.push('|--------|----------|----------|----------|');
        
        for (const mapping of data.mappings) {
          const originalShort = mapping.original.length > 30 
            ? mapping.original.substring(0, 30) + '...' 
            : mapping.original;
          const files = mapping.files.join(', ');
          lines.push(`| ${originalShort} | ${mapping.masked} | ${mapping.count} | ${files} |`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
