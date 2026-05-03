import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'csv-stringify/sync';
import { FileConfig } from '../types';

export class FileWriter {
  static ensureOutputDir(outputDir: string): void {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  static writeCsv(
    outputPath: string,
    records: any[],
    headers: string[]
  ): void {
    this.ensureOutputDir(path.dirname(outputPath));

    const content = stringify(records, {
      header: true,
      columns: headers,
      quoted: true,
      quoted_empty: true,
    });

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  static writeJson(
    outputPath: string,
    records: any[],
    prettyPrint: boolean = true
  ): void {
    this.ensureOutputDir(path.dirname(outputPath));

    const content = prettyPrint 
      ? JSON.stringify(records, null, 2)
      : JSON.stringify(records);

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  static writeFile(
    outputPath: string,
    records: any[],
    headers: string[],
    format: 'csv' | 'json' = 'csv'
  ): void {
    if (format === 'json') {
      this.writeJson(outputPath, records);
    } else {
      this.writeCsv(outputPath, records, headers);
    }
  }

  static generateOutputPath(
    originalPath: string,
    outputDir: string,
    preserveOriginalName: boolean = true,
    outputFormat?: 'csv' | 'json'
  ): string {
    const originalBasename = path.basename(originalPath);
    const originalExt = path.extname(originalBasename);
    const originalName = path.basename(originalBasename, originalExt);

    let newExt = originalExt;
    if (outputFormat) {
      newExt = outputFormat === 'json' ? '.json' : '.csv';
    }

    if (preserveOriginalName) {
      return path.join(outputDir, `${originalName}_masked${newExt}`);
    } else {
      const timestamp = Date.now();
      return path.join(outputDir, `masked_${timestamp}${newExt}`);
    }
  }

  static writeMappingFile(
    outputPath: string,
    mappings: Map<string, { original: string; masked: string; type: string; count: number }[]>
  ): void {
    this.ensureOutputDir(path.dirname(outputPath));

    const output: any = {};
    
    for (const [type, typeMappings] of mappings.entries()) {
      output[type] = typeMappings.map(m => ({
        original: m.original,
        masked: m.masked,
        occurrences: m.count,
      }));
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  }

  static writeSummary(
    outputPath: string,
    summary: any,
    format: 'json' | 'markdown' = 'json'
  ): void {
    this.ensureOutputDir(path.dirname(outputPath));

    let content: string;

    if (format === 'markdown') {
      content = this.generateMarkdownSummary(summary);
    } else {
      content = JSON.stringify(summary, null, 2);
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
  }

  private static generateMarkdownSummary(summary: any): string {
    const lines: string[] = [];
    
    lines.push('# 数据脱敏报告');
    lines.push('');
    lines.push(`**生成时间**: ${summary.timestamp}`);
    lines.push(`**配置文件**: ${summary.configFile}`);
    lines.push(`**Dry Run**: ${summary.dryRun ? '是' : '否'}`);
    lines.push('');
    
    lines.push('## 处理概览');
    lines.push('');
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 处理文件数 | ${summary.totalFiles} |`);
    lines.push(`| 总记录数 | ${summary.totalRecords} |`);
    lines.push(`| 脱敏字段总数 | ${summary.totalMaskedFields} |`);
    lines.push('');

    lines.push('## 各类型统计');
    lines.push('');
    lines.push(`| 类型 | 脱敏数量 |`);
    lines.push(`|------|----------|`);
    
    for (const [type, count] of Object.entries(summary.mappingStats || {})) {
      lines.push(`| ${type} | ${count} |`);
    }
    
    lines.push('');

    if (summary.files && summary.files.length > 0) {
      lines.push('## 文件详情');
      lines.push('');
      
      for (const fileResult of summary.files) {
        lines.push(`### ${path.basename(fileResult.filePath)}`);
        lines.push('');
        lines.push(`- 输出路径: ${fileResult.outputPath}`);
        lines.push(`- 总记录数: ${fileResult.totalRecords}`);
        lines.push('');
        
        if (fileResult.maskedFields && Object.keys(fileResult.maskedFields).length > 0) {
          lines.push('**脱敏字段统计:**');
          lines.push('');
          lines.push(`| 字段 | 脱敏数量 |`);
          lines.push(`|------|----------|`);
          
          for (const [field, count] of Object.entries(fileResult.maskedFields)) {
            lines.push(`| ${field} | ${count} |`);
          }
          
          lines.push('');
        }

        if (fileResult.warnings && fileResult.warnings.length > 0) {
          lines.push('**警告:**');
          for (const warning of fileResult.warnings) {
            lines.push(`- ⚠️ ${warning}`);
          }
          lines.push('');
        }

        if (fileResult.errors && fileResult.errors.length > 0) {
          lines.push('**错误:**');
          for (const error of fileResult.errors) {
            lines.push(`- ❌ ${error}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }
}
