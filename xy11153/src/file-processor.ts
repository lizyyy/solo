import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import chalk from 'chalk';
import { CourtRecord, ProcessOptions, ProcessResult } from './types';
import { RulesEngine } from './rules-engine';

export class FileProcessor {
  private rulesEngine: RulesEngine;
  private options: ProcessOptions;

  constructor(options: ProcessOptions) {
    this.options = options;
    this.rulesEngine = new RulesEngine(options.rulesPath);
  }

  readCSV(filePath: string): CourtRecord[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      encoding: 'utf-8',
    });
    return records as CourtRecord[];
  }

  writeCSV(filePath: string, records: CourtRecord[]): void {
    const config = this.rulesEngine.getConfig();
    const columns = config.outputConfig.columns;
    
    const output = stringify(records, {
      header: config.outputConfig.includeHeader,
      columns: columns as unknown as string[],
      delimiter: config.outputConfig.delimiter,
      encoding: config.outputConfig.encoding as BufferEncoding,
    });

    fs.writeFileSync(filePath, output, 'utf-8');
  }

  private generateTimestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  }

  processRecords(records: CourtRecord[]): ProcessResult {
    const warnings: string[] = [];
    const normalRecords: CourtRecord[] = [];
    const abnormalRecords: CourtRecord[] = [];
    const partialRainRecords: CourtRecord[] = [];
    const halfCourtUsageRecords: CourtRecord[] = [];

    records.forEach((record, index) => {
      const recordWarnings = this.rulesEngine.validateRecord(record, index);
      warnings.push(...recordWarnings);

      const processed = this.rulesEngine.processRecord(record);

      if (this.rulesEngine.isNormalRecord(record)) {
        normalRecords.push(processed);
      }
      
      if (this.rulesEngine.isAbnormalRecord(record)) {
        abnormalRecords.push(processed);
      }

      if (this.rulesEngine.isPartialRain(record)) {
        partialRainRecords.push(processed);
      }

      if (this.rulesEngine.isHalfCourtUsage(record)) {
        halfCourtUsageRecords.push(processed);
      }
    });

    const config = this.rulesEngine.getConfig();
    if (config.outputConfig.stableOutput) {
      normalRecords.sort((a, b) => String(a.预约编号).localeCompare(String(b.预约编号)));
      abnormalRecords.sort((a, b) => String(a.预约编号).localeCompare(String(b.预约编号)));
      partialRainRecords.sort((a, b) => String(a.预约编号).localeCompare(String(b.预约编号)));
      halfCourtUsageRecords.sort((a, b) => String(a.预约编号).localeCompare(String(b.预约编号)));
    }

    return {
      totalRecords: records.length,
      normalRecords,
      abnormalRecords,
      partialRainRecords,
      halfCourtUsageRecords,
      outputFiles: [],
      warnings,
    };
  }

  private printSummary(result: ProcessResult): void {
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan.bold('📊 篮球场预约处球场天气补偿 - 处理结果汇总'));
    console.log(chalk.cyan('='.repeat(60)));
    
    console.log(chalk.white(`\n📋 总记录数: ${chalk.bold(result.totalRecords)}`));
    console.log(chalk.green(`✅ 正常记录数: ${chalk.bold(result.normalRecords.length)}`));
    console.log(chalk.yellow(`⚠️  异常记录数: ${chalk.bold(result.abnormalRecords.length)}`));
    console.log(chalk.blue(`🌧️  局部降雨记录数: ${chalk.bold(result.partialRainRecords.length)}`));
    console.log(chalk.magenta(`🏀 半场使用记录数: ${chalk.bold(result.halfCourtUsageRecords.length)}`));

    if (result.warnings.length > 0) {
      console.log(chalk.red(`\n⚠️  警告信息 (${result.warnings.length}条):`));
      result.warnings.forEach(warning => {
        console.log(chalk.yellow(`   - ${warning}`));
      });
    }

    console.log(chalk.cyan('\n' + '='.repeat(60)));
  }

  private printPreview(result: ProcessResult): void {
    console.log(chalk.cyan.bold('\n📋 记录分类详情预览:\n'));

    if (result.abnormalRecords.length > 0) {
      console.log(chalk.yellow.bold('⚠️  异常记录样例 (前5条):'));
      result.abnormalRecords.slice(0, 5).forEach(record => {
        console.log(chalk.yellow(`   ${record.预约编号} | ${record.球场编号} | ${record.预约日期} | ${record.天气状况} | ${record.标签 || '-'} | ${record.补偿类型}`));
      });
      console.log();
    }

    if (result.partialRainRecords.length > 0) {
      console.log(chalk.blue.bold('🌧️  局部降雨记录样例 (前5条):'));
      result.partialRainRecords.slice(0, 5).forEach(record => {
        console.log(chalk.blue(`   ${record.预约编号} | ${record.球场编号} | ${record.降雨时段 || '-'} | ${record.备注}`));
      });
      console.log();
    }

    if (result.halfCourtUsageRecords.length > 0) {
      console.log(chalk.magenta.bold('🏀 半场使用记录样例 (前5条):'));
      result.halfCourtUsageRecords.slice(0, 5).forEach(record => {
        console.log(chalk.magenta(`   ${record.预约编号} | ${record.球场编号} | ${record.备注}`));
      });
      console.log();
    }
  }

  private writeOutputFiles(result: ProcessResult): string[] {
    const outputFiles: string[] = [];
    const timestamp = this.generateTimestamp();
    const outputDir = this.options.outputDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const config = this.rulesEngine.getConfig();

    const writeFile = (filename: string, records: CourtRecord[]) => {
      const basename = path.basename(filename, '.csv');
      const outputPath = path.join(outputDir, `${basename}_${timestamp}.csv`);
      this.writeCSV(outputPath, records);
      outputFiles.push(outputPath);
      console.log(chalk.green(`   ✅ 已写入: ${path.relative(process.cwd(), outputPath)} (${records.length}条记录)`));
    };

    console.log(chalk.cyan.bold('\n💾 写入输出文件:'));
    
    if (result.normalRecords.length > 0) {
      writeFile(config.recordClassification.normalRecords.outputFile, result.normalRecords);
    }

    if (result.abnormalRecords.length > 0) {
      writeFile(config.recordClassification.abnormalRecords.outputFile, result.abnormalRecords);
    }

    if (result.partialRainRecords.length > 0) {
      writeFile(config.specialScenarios.partialRain.outputFile, result.partialRainRecords);
    }

    if (result.halfCourtUsageRecords.length > 0) {
      writeFile(config.specialScenarios.halfCourtUsage.outputFile, result.halfCourtUsageRecords);
    }

    return outputFiles;
  }

  run(): ProcessResult {
    console.log(chalk.cyan.bold('\n🏀 篮球场预约处球场天气补偿 CLI 工具'));
    console.log(chalk.gray(`模式: ${this.options.mode === 'preview' ? '预览模式' : '正式模式'}`));
    console.log(chalk.gray(`输入文件: ${this.options.input}`));
    console.log(chalk.gray(`规则配置: ${this.options.rulesPath}`));

    if (!fs.existsSync(this.options.input)) {
      throw new Error(`输入文件不存在: ${this.options.input}`);
    }

    const records = this.readCSV(this.options.input);
    console.log(chalk.white(`\n📥 读取到 ${chalk.bold(records.length)} 条记录`));

    const result = this.processRecords(records);
    
    this.printSummary(result);
    this.printPreview(result);

    if (this.options.mode === 'run') {
      const outputFiles = this.writeOutputFiles(result);
      result.outputFiles = outputFiles;
      console.log(chalk.green.bold(`\n🎉 处理完成！共生成 ${outputFiles.length} 个输出文件。`));
    } else {
      console.log(chalk.blue.bold('\n📋 预览模式 - 未写入文件。使用 "run" 命令生成输出文件。'));
    }

    return result;
  }
}
