import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import { TrainingRecord, AbnormalRecord, ProcessedResult, Statistics, ProcessOptions, FailedFile } from './types.js';
import { logger } from './logger.js';

const KEY_BUSINESS_COLUMNS = [
  '员工编号',
  '员工姓名',
  '所属部门',
  '培训课程',
  '培训日期',
  '培训时长',
  '考试成绩',
  '是否通过',
  '讲师',
  '培训地点'
];

export class TrainingScoreProcessor {
  private options: ProcessOptions;
  private allRecords: TrainingRecord[] = [];
  private skippedFiles: string[] = [];
  private failedFiles: FailedFile[] = [];

  constructor(options: ProcessOptions) {
    this.options = options;
  }

  async processFiles(filePaths: string[]): Promise<ProcessedResult> {
    logger.info(`开始处理 ${filePaths.length} 个文件...`);

    for (const filePath of filePaths) {
      await this.processSingleFile(filePath);
    }

    const { normalRecords, abnormalRecords, statistics } = this.classifyRecords();

    await this.writeResults(normalRecords, abnormalRecords);

    return {
      normalRecords,
      abnormalRecords,
      skippedFiles: this.skippedFiles,
      failedFiles: this.failedFiles,
      statistics
    };
  }

  private async processSingleFile(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);

    if (!fs.existsSync(filePath)) {
      this.failedFiles.push({ 文件名: fileName, 错误信息: '文件不存在' });
      logger.error(`文件不存在: ${fileName}`);
      return;
    }

    if (!filePath.toLowerCase().endsWith('.csv')) {
      this.skippedFiles.push(fileName);
      logger.warning(`跳过非CSV文件: ${fileName}`);
      return;
    }

    try {
      logger.verboseInfo(`正在读取: ${fileName}`);
      const records = await this.parseCsvFile(filePath);
      logger.verboseInfo(`  读取到 ${records.length} 条记录`);

      records.forEach(record => {
        record.来源文件 = fileName;
        this.allRecords.push(record);
      });

      logger.success(`成功处理: ${fileName} (${records.length} 条记录)`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      this.failedFiles.push({ 文件名: fileName, 错误信息: errorMsg });
      logger.error(`处理失败: ${fileName} - ${errorMsg}`);
    }
  }

  private async parseCsvFile(filePath: string): Promise<TrainingRecord[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const records: TrainingRecord[] = [];
    let lineNumber = 1;

    const parser = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    for await (const record of parser) {
      lineNumber++;
      records.push({
        ...record,
        来源文件: '',
        行号: lineNumber
      } as TrainingRecord);
    }

    return records;
  }

  private classifyRecords(): {
    normalRecords: TrainingRecord[];
    abnormalRecords: AbnormalRecord[];
    statistics: Statistics;
  } {
    logger.info('开始分类记录...');

    const normalRecords: TrainingRecord[] = [];
    const abnormalRecords: AbnormalRecord[] = [];

    const nameCount = new Map<string, number>();
    this.allRecords.forEach(record => {
      const key = record.员工姓名;
      nameCount.set(key, (nameCount.get(key) || 0) + 1);
    });

    const departmentChanges = new Map<string, Set<string>>();
    this.allRecords.forEach(record => {
      const key = record.员工编号;
      if (!departmentChanges.has(key)) {
        departmentChanges.set(key, new Set());
      }
      departmentChanges.get(key)!.add(record.所属部门);
    });

    let duplicateNameCount = 0;
    let departmentChangeCount = 0;
    let rerunOutputCount = 0;
    let dataErrorCount = 0;

    for (const record of this.allRecords) {
      const abnormalTypes: string[] = [];
      const abnormalReasons: string[] = [];

      if (nameCount.get(record.员工姓名)! > 1) {
        abnormalTypes.push('同名员工');
        abnormalReasons.push(`存在 ${nameCount.get(record.员工姓名)} 条同名员工记录，员工编号可能不唯一`);
        duplicateNameCount++;
      }

      if (departmentChanges.get(record.员工编号)!.size > 1) {
        abnormalTypes.push('部门调整');
        abnormalReasons.push(`该员工编号对应多个部门: ${Array.from(departmentChanges.get(record.员工编号)!).join(', ')}`);
        departmentChangeCount++;
      }

      if (record.培训课程.includes('(复跑)') || record.培训课程.includes('(重测)') || record.是否通过 === '复跑') {
        abnormalTypes.push('可复跑输出');
        abnormalReasons.push('该记录标记为复跑/重测，需要单独处理');
        rerunOutputCount++;
      }

      if (!record.员工编号 || !record.员工姓名 || !record.培训课程) {
        abnormalTypes.push('数据异常');
        abnormalReasons.push('关键业务列数据缺失');
        dataErrorCount++;
      }

      if (abnormalTypes.length > 0) {
        const abnormalRecord: AbnormalRecord = {
          ...record,
          异常类型: abnormalTypes.join('; ') as any,
          异常说明: abnormalReasons.join('; ')
        };
        abnormalRecords.push(abnormalRecord);
        logger.verboseRecord(abnormalRecord);
      } else {
        normalRecords.push(record);
      }
    }

    this.sortRecords(normalRecords);
    this.sortAbnormalRecords(abnormalRecords);

    const statistics: Statistics = {
      总文件数: 0,
      成功处理文件数: 0,
      跳过文件数: this.skippedFiles.length,
      失败文件数: this.failedFiles.length,
      总记录数: this.allRecords.length,
      正常记录数: normalRecords.length,
      异常记录数: abnormalRecords.length,
      同名员工数: duplicateNameCount,
      部门调整数: departmentChangeCount,
      可复跑输出数: rerunOutputCount,
      数据异常数: dataErrorCount
    };

    logger.success(`分类完成: 正常 ${normalRecords.length} 条, 异常 ${abnormalRecords.length} 条`);

    return { normalRecords, abnormalRecords, statistics };
  }

  private sortRecords(records: TrainingRecord[]): void {
    records.sort((a, b) => {
      if (a.所属部门 !== b.所属部门) return a.所属部门.localeCompare(b.所属部门);
      if (a.员工编号 !== b.员工编号) return a.员工编号.localeCompare(b.员工编号);
      if (a.培训日期 !== b.培训日期) return a.培训日期.localeCompare(b.培训日期);
      return a.培训课程.localeCompare(b.培训课程);
    });
  }

  private sortAbnormalRecords(records: AbnormalRecord[]): void {
    records.sort((a, b) => {
      if (a.异常类型 !== b.异常类型) return a.异常类型.localeCompare(b.异常类型);
      if (a.所属部门 !== b.所属部门) return a.所属部门.localeCompare(b.所属部门);
      if (a.员工编号 !== b.员工编号) return a.员工编号.localeCompare(b.员工编号);
      return a.培训日期.localeCompare(b.培训日期);
    });
  }

  private async writeResults(normalRecords: TrainingRecord[], abnormalRecords: AbnormalRecord[]): Promise<void> {
    const outputDir = this.options.outputDir;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    logger.info(`正在写入结果到: ${outputDir}`);

    const normalOutput = normalRecords.map(record => {
      const result: any = {};
      for (const col of KEY_BUSINESS_COLUMNS) {
        result[col] = record[col as keyof TrainingRecord];
      }
      result.来源文件 = record.来源文件;
      return result;
    });

    const normalCsv = stringify(normalOutput, {
      header: true,
      columns: [...KEY_BUSINESS_COLUMNS, '来源文件']
    });

    fs.writeFileSync(path.join(outputDir, '正常记录.csv'), normalCsv, 'utf-8');
    logger.verboseInfo(`  已写入: 正常记录.csv (${normalRecords.length} 条)`);

    const abnormalOutput = abnormalRecords.map(record => {
      const result: any = {};
      for (const col of KEY_BUSINESS_COLUMNS) {
        result[col] = record[col as keyof TrainingRecord];
      }
      result.来源文件 = record.来源文件;
      result.异常类型 = record.异常类型;
      result.异常说明 = record.异常说明;
      return result;
    });

    const abnormalCsv = stringify(abnormalOutput, {
      header: true,
      columns: [...KEY_BUSINESS_COLUMNS, '来源文件', '异常类型', '异常说明']
    });

    fs.writeFileSync(path.join(outputDir, '异常记录.csv'), abnormalCsv, 'utf-8');
    logger.verboseInfo(`  已写入: 异常记录.csv (${abnormalRecords.length} 条)`);

    logger.success('结果文件写入完成');
  }
}
