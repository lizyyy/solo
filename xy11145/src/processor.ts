import * as fs from 'fs';
import * as path from 'path';
import { FileParser } from './parser';
import { Reporter } from './reporter';
import { IdempotencyManager } from './idempotency';
import { MedicalReport, ParseError, Statistics, ProcessResult } from './types';

export class ReportProcessor {
  private parser: FileParser;
  private reporter: Reporter;
  private idempotency: IdempotencyManager;
  private allRecords: MedicalReport[] = [];
  private allErrors: ParseError[] = [];
  private processedFilesCount = 0;
  private failedFilesCount = 0;

  constructor(private outputDir: string) {
    this.parser = new FileParser();
    this.reporter = new Reporter(outputDir);
    this.idempotency = new IdempotencyManager(outputDir);
  }

  async processFile(filePath: string): Promise<boolean> {
    const fileName = path.basename(filePath);
    console.log(`\n📄 处理文件: ${fileName}`);

    if (this.idempotency.isFileProcessed(filePath)) {
      console.log(`   ⏭️  文件已处理过，跳过`);
      return true;
    }

    try {
      const { records, errors } = await this.parser.parseFile(filePath);
      
      const newRecords = this.idempotency.filterNewRecords(records);
      const skippedCount = records.length - newRecords.length;

      newRecords.forEach(record => {
        this.allRecords.push(record);
        this.idempotency.markRecordProcessed(record);
      });

      this.allErrors.push(...errors);

      if (errors.length > 0) {
        console.log(`   ✅ 有效记录: ${newRecords.length}`);
        if (skippedCount > 0) {
          console.log(`   ⏭️  重复记录: ${skippedCount}`);
        }
        console.log(`   ⚠️ 发现错误: ${errors.length}`);
      } else {
        console.log(`   ✅ 成功处理 ${newRecords.length} 条记录`);
        if (skippedCount > 0) {
          console.log(`   ⏭️  跳过 ${skippedCount} 条重复记录`);
        }
      }

      this.idempotency.markFileProcessed(filePath);
      this.processedFilesCount++;
      return true;
    } catch (err: any) {
      console.error(`   ❌ 处理失败: ${err.message}`);
      this.allErrors.push({
        file: fileName,
        errorType: 'parse_failed',
        message: err.message
      });
      this.failedFilesCount++;
      return false;
    }
  }

  async processDirectory(inputDir: string): Promise<ProcessResult> {
    console.log(`\n🔍 扫描目录: ${inputDir}`);

    if (!fs.existsSync(inputDir)) {
      throw new Error(`输入目录不存在: ${inputDir}`);
    }

    const files = fs.readdirSync(inputDir)
      .filter(f => f.endsWith('.csv') || f.endsWith('.json'))
      .map(f => path.join(inputDir, f));

    console.log(`   发现 ${files.length} 个待处理文件`);

    for (const file of files) {
      await this.processFile(file);
    }

    this.idempotency.commit();
    return this.finalize(files.length);
  }

  private async finalize(totalFiles: number): Promise<ProcessResult> {
    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有文件处理完成，生成报告...');

    const statistics = this.reporter.analyzeRecords(this.allRecords, this.allErrors);
    statistics.totalFiles = totalFiles;
    statistics.processedFiles = this.processedFilesCount;
    statistics.failedFiles = this.failedFilesCount;
    statistics.skippedRecords = statistics.totalRecords - statistics.validRecords;

    this.allRecords.forEach(record => {
      if (record.reportStatus !== 'withdrawn') {
        record.distributionStatus = 'distributed';
      }
    });

    const result = await this.reporter.writeOutput(this.allRecords, statistics);
    this.reporter.printConsoleSummary(statistics);

    return result;
  }

  reset(): void {
    this.idempotency.reset();
    this.allRecords = [];
    this.allErrors = [];
    this.processedFilesCount = 0;
    this.failedFilesCount = 0;
    console.log('🔄 已重置处理状态');
  }

  getStatistics(): Statistics {
    return this.reporter.analyzeRecords(this.allRecords, this.allErrors);
  }
}
