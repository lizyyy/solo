import * as fs from 'fs';
import * as path from 'path';
import { OptimizationReport, BenchmarkResult } from './types';

export class ReportGenerator {
  private report: OptimizationReport;
  private outputDir: string;

  constructor(report: OptimizationReport, outputDir?: string) {
    this.report = report;
    this.outputDir = outputDir || report.metadata.config.output.outputDir || './reports';
  }

  generateAll(formats: ('markdown' | 'json' | 'csv')[]): string[] {
    const generatedFiles: string[] = [];

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    for (const format of formats) {
      let content: string;
      let filename: string;

      switch (format) {
        case 'markdown':
          content = this.generateMarkdown();
          filename = `optimization-report-${timestamp}.md`;
          break;
        case 'json':
          content = this.generateJson();
          filename = `optimization-report-${timestamp}.json`;
          break;
        case 'csv':
          content = this.generateCsv();
          filename = `optimization-report-${timestamp}.csv`;
          break;
        default:
          continue;
      }

      const filePath = path.join(this.outputDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');
      generatedFiles.push(filePath);
      console.log(`  报告已生成: ${filePath}`);
    }

    return generatedFiles;
  }

  generateMarkdown(): string {
    const lines: string[] = [];

    lines.push('# SQLite 写入优化报告');
    lines.push('');
    lines.push(`生成时间: ${new Date(this.report.metadata.generatedAt).toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 执行摘要');
    lines.push('');
    lines.push('| 指标 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 测试记录数 | ${this.report.summary.totalRecords.toLocaleString()} |`);
    lines.push(`| 测试策略数 | ${this.report.summary.totalTests} |`);
    lines.push(`| 最佳策略 | ${this.report.summary.bestStrategy} |`);
    lines.push(`| 最佳性能 | ${this.report.summary.bestPerformance.toFixed(0)} 记录/秒 |`);
    lines.push(`| 最差策略 | ${this.report.summary.worstStrategy} |`);
    lines.push(`| 最差性能 | ${this.report.summary.worstPerformance.toFixed(0)} 记录/秒 |`);
    lines.push(`| 性能提升倍数 | **${this.report.summary.improvementRatio.toFixed(1)}x** |`);
    lines.push('');

    lines.push('## 关键优化建议');
    lines.push('');

    const priorityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    const priorityLabel: Record<string, string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };

    for (const rec of this.report.recommendations) {
      lines.push(`### ${priorityEmoji[rec.priority]} [${priorityLabel[rec.priority]}] ${rec.title}`);
      lines.push('');
      lines.push(`**类别**: ${rec.category}`);
      lines.push('');
      lines.push(`**问题描述**: ${rec.description}`);
      lines.push('');
      lines.push(`**预期提升**: ${rec.expectedImprovement}`);
      lines.push('');
      lines.push(`**操作建议**: ${rec.action}`);
      lines.push('');
      lines.push(`**详细原因**: ${rec.reason}`);
      lines.push('');
    }

    lines.push('## 推荐配置');
    lines.push('');
    lines.push('| 配置项 | 推荐值 |');
    lines.push('|--------|--------|');
    lines.push(`| 推荐批量大小 (Batch Size) | **${this.report.suggestedBatchSize}** |`);
    lines.push(`| 推荐 Journal 模式 | **${this.report.suggestedJournalMode}** |`);
    lines.push('');

    lines.push('### 推荐配置代码示例');
    lines.push('');
    lines.push('```typescript');
    lines.push('// 使用 better-sqlite3');
    lines.push('import Database from \'better-sqlite3\';');
    lines.push('');
    lines.push('const db = new Database(\'your-database.db\');');
    lines.push('');
    lines.push(`// 设置 Journal 模式为 ${this.report.suggestedJournalMode}`);
    lines.push(`db.pragma('journal_mode = ${this.report.suggestedJournalMode}');`);
    lines.push('db.pragma(\'synchronous = NORMAL\');');
    lines.push('db.pragma(\'temp_store = MEMORY\');');
    lines.push('db.pragma(\'cache_size = 10000\');');
    lines.push('');
    lines.push('// 使用批量事务');
    lines.push(`const batchSize = ${this.report.suggestedBatchSize};`);
    lines.push('');
    lines.push('const insertMany = db.transaction((records) => {');
    lines.push('  const stmt = db.prepare(\'INSERT INTO table_name VALUES (...)\');');
    lines.push('  for (const record of records) {');
    lines.push('    stmt.run(record);');
    lines.push('  }');
    lines.push('});');
    lines.push('');
    lines.push('// 分批次插入');
    lines.push('for (let i = 0; i < allRecords.length; i += batchSize) {');
    lines.push('  const batch = allRecords.slice(i, i + batchSize);');
    lines.push('  insertMany(batch);');
    lines.push('}');
    lines.push('```');
    lines.push('');

    lines.push('## 索引建议');
    lines.push('');

    if (this.report.indexRecommendations.length > 0) {
      for (const idxRec of this.report.indexRecommendations) {
        const actionEmoji = idxRec.action === 'ADD' ? '➕' : idxRec.action === 'DROP' ? '➖' : '✓';
        lines.push(`### ${actionEmoji} ${idxRec.action}: ${idxRec.indexName}`);
        lines.push('');
        lines.push(`- **表**: ${idxRec.table}`);
        lines.push(`- **列**: ${idxRec.columns.length > 0 ? idxRec.columns.join(', ') : '多列'}`);
        lines.push(`- **原因**: ${idxRec.reason}`);
        lines.push(`- **影响**: ${idxRec.impact}`);
        lines.push('');
      }
    } else {
      lines.push('暂无索引建议。');
      lines.push('');
    }

    lines.push('## 基准测试详细结果');
    lines.push('');

    lines.push('| 排名 | 策略 | 策略类型 | 总耗时 (ms) | 每条耗时 (ms) | 记录/秒 | 文件大小 |');
    lines.push('|------|------|----------|-------------|---------------|---------|----------|');

    for (let i = 0; i < this.report.benchmarkResults.length; i++) {
      const result = this.report.benchmarkResults[i];
      const isBest = i === 0;
      const isWorst = i === this.report.benchmarkResults.length - 1;
      
      let strategyDisplay = result.strategy;
      if (isBest) strategyDisplay = `**${strategyDisplay} (最佳)**`;
      if (isWorst) strategyDisplay = `~~${strategyDisplay} (最差)~~`;

      lines.push(
        `| ${i + 1} | ${strategyDisplay} | ${result.strategyType} | ` +
        `${result.metrics.totalTimeMs.toFixed(2)} | ` +
        `${result.metrics.avgTimePerRecordMs.toFixed(4)} | ` +
        `${result.metrics.recordsPerSecond.toFixed(0)} | ` +
        `${this.formatFileSize(result.metrics.fileSizeAfter || 0)} |`
      );
    }
    lines.push('');

    lines.push('### 各维度性能对比');
    lines.push('');

    const strategyTypes = [...new Set(this.report.benchmarkResults.map(r => r.strategyType))];
    
    for (const type of strategyTypes) {
      const typeResults = this.report.benchmarkResults.filter(r => r.strategyType === type);
      if (typeResults.length < 2) continue;

      const typeLabels: Record<string, string> = {
        transaction: '事务模式',
        batch: '批量大小',
        journal: 'Journal 模式',
        connection: '连接模式',
        statement: '语句模式',
        index: '索引模式',
      };

      lines.push(`#### ${typeLabels[type] || type}`);
      lines.push('');
      lines.push('| 策略 | 记录/秒 | 相对性能 |');
      lines.push('|------|---------|----------|');

      const sorted = [...typeResults].sort((a, b) => b.metrics.recordsPerSecond - a.metrics.recordsPerSecond);
      const bestRps = sorted[0].metrics.recordsPerSecond;

      for (const result of sorted) {
        const relative = (result.metrics.recordsPerSecond / bestRps * 100).toFixed(1);
        const isBest = result.metrics.recordsPerSecond === bestRps;
        lines.push(
          `| ${isBest ? '**' : ''}${result.strategy}${isBest ? ' (最佳)**' : ''} | ` +
          `${result.metrics.recordsPerSecond.toFixed(0)} | ` +
          `${relative}% |`
        );
      }
      lines.push('');
    }

    lines.push('## 附录');
    lines.push('');
    lines.push('### 测试配置');
    lines.push('');
    lines.push('```yaml');
    lines.push('benchmark:');
    lines.push(`  warmupRuns: ${this.report.metadata.config.benchmark.warmupRuns}`);
    lines.push(`  testRuns: ${this.report.metadata.config.benchmark.testRuns}`);
    lines.push(`  recordCount: ${this.report.metadata.config.benchmark.recordCount}`);
    lines.push('```');
    lines.push('');

    lines.push('### 工具版本');
    lines.push('');
    lines.push(`- sqlite-write-optimizer: ${this.report.metadata.version}`);
    lines.push(`- 生成时间: ${this.report.metadata.generatedAt}`);
    lines.push('');

    return lines.join('\n');
  }

  generateJson(): string {
    return JSON.stringify(this.report, null, 2);
  }

  generateCsv(): string {
    const lines: string[] = [];

    lines.push('===== 执行摘要 =====');
    lines.push('指标,值');
    lines.push(`测试记录数,${this.report.summary.totalRecords}`);
    lines.push(`测试策略数,${this.report.summary.totalTests}`);
    lines.push(`最佳策略,${this.report.summary.bestStrategy}`);
    lines.push(`最佳性能(记录/秒),${this.report.summary.bestPerformance.toFixed(0)}`);
    lines.push(`最差策略,${this.report.summary.worstStrategy}`);
    lines.push(`最差性能(记录/秒),${this.report.summary.worstPerformance.toFixed(0)}`);
    lines.push(`性能提升倍数,${this.report.summary.improvementRatio.toFixed(1)}`);
    lines.push('');

    lines.push('===== 优化建议 =====');
    lines.push('优先级,类别,标题,描述,预期提升,操作建议,原因');
    
    const priorityMap: Record<string, string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };

    for (const rec of this.report.recommendations) {
      lines.push(
        `${priorityMap[rec.priority]},` +
        `${this.escapeCsv(rec.category)},` +
        `${this.escapeCsv(rec.title)},` +
        `${this.escapeCsv(rec.description)},` +
        `${this.escapeCsv(rec.expectedImprovement)},` +
        `${this.escapeCsv(rec.action)},` +
        `${this.escapeCsv(rec.reason)}`
      );
    }
    lines.push('');

    lines.push('===== 推荐配置 =====');
    lines.push('配置项,推荐值');
    lines.push(`推荐批量大小,${this.report.suggestedBatchSize}`);
    lines.push(`推荐 Journal 模式,${this.report.suggestedJournalMode}`);
    lines.push('');

    lines.push('===== 索引建议 =====');
    lines.push('操作,索引名,表,列,原因,影响');
    for (const idxRec of this.report.indexRecommendations) {
      lines.push(
        `${idxRec.action},` +
        `${this.escapeCsv(idxRec.indexName)},` +
        `${this.escapeCsv(idxRec.table)},` +
        `${this.escapeCsv(idxRec.columns.join(', '))},` +
        `${this.escapeCsv(idxRec.reason)},` +
        `${this.escapeCsv(idxRec.impact)}`
      );
    }
    lines.push('');

    lines.push('===== 基准测试结果 =====');
    lines.push('排名,策略,策略类型,总耗时(ms),每条耗时(ms),记录/秒,文件大小');
    for (let i = 0; i < this.report.benchmarkResults.length; i++) {
      const result = this.report.benchmarkResults[i];
      lines.push(
        `${i + 1},` +
        `${this.escapeCsv(result.strategy)},` +
        `${result.strategyType},` +
        `${result.metrics.totalTimeMs.toFixed(2)},` +
        `${result.metrics.avgTimePerRecordMs.toFixed(4)},` +
        `${result.metrics.recordsPerSecond.toFixed(0)},` +
        `${this.formatFileSize(result.metrics.fileSizeAfter || 0)}`
      );
    }

    return lines.join('\n');
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  printConsoleSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 SQLite 写入优化报告 - 执行摘要');
    console.log('='.repeat(60));
    console.log('');
    
    console.log('【性能对比】');
    console.log(`  最佳策略: ${this.report.summary.bestStrategy}`);
    console.log(`  最佳性能: ${this.report.summary.bestPerformance.toFixed(0)} 记录/秒`);
    console.log(`  最差策略: ${this.report.summary.worstStrategy}`);
    console.log(`  最差性能: ${this.report.summary.worstPerformance.toFixed(0)} 记录/秒`);
    console.log(`  性能提升: ${this.report.summary.improvementRatio.toFixed(1)}x`);
    console.log('');

    console.log('【推荐配置】');
    console.log(`  推荐批量大小: ${this.report.suggestedBatchSize}`);
    console.log(`  推荐 Journal 模式: ${this.report.suggestedJournalMode}`);
    console.log('');

    console.log('【Top 优化建议】');
    const priorityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };

    for (let i = 0; i < Math.min(3, this.report.recommendations.length); i++) {
      const rec = this.report.recommendations[i];
      console.log(`  ${i + 1}. ${priorityEmoji[rec.priority]} ${rec.title}`);
      console.log(`     ${rec.expectedImprovement}`);
      console.log(`     操作: ${rec.action}`);
      console.log('');
    }

    console.log('='.repeat(60) + '\n');
  }
}
