#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

import { parseDirectory, parseDeviceCSV, parseBatchCSV } from './src/parser.js';
import { 
  checkAllAnomalies, 
  mergeRecords, 
  getAnomalySummary,
  DEFAULT_RULES 
} from './src/rules.js';
import { storage } from './src/storage.js';
import { generateMarkdownReport, generateCSVSummary, generateReviewList } from './src/reporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name('incubator-log')
  .description('培养箱巡检日志整理器')
  .version('1.0.0');

program
  .command('import')
  .description('导入设备CSV和批次CSV并进行分析')
  .option('-d, --device <path>', '设备CSV文件或目录路径')
  .option('-b, --batch <path>', '批次CSV文件或目录路径')
  .option('-o, --output <dir>', '输出目录 (默认: ./output)')
  .option('-t, --temp-range <min,max>', '温度范围 (默认: 36.0,38.0)')
  .option('-H, --humidity-range <min,max>', '湿度范围 (默认: 80,95)')
  .option('-g, --gap-minutes <minutes>', '传感器断点阈值(分钟) (默认: 60)')
  .option('-r, --recovery-minutes <minutes>', '开门恢复阈值(分钟) (默认: 15)')
  .action(async (options) => {
    try {
      console.log(chalk.blue('=== 培养箱巡检日志整理器 ===\n'));

      if (!options.device) {
        console.error(chalk.red('错误: 请提供设备CSV路径 (-d 或 --device)'));
        process.exit(1);
      }

      if (!options.batch) {
        console.error(chalk.red('错误: 请提供批次CSV路径 (-b 或 --batch)'));
        process.exit(1);
      }

      const rules = { ...DEFAULT_RULES };
      
      if (options.tempRange) {
        const [min, max] = options.tempRange.split(',').map(parseFloat);
        rules.temperature = { min, max };
      }
      
      if (options.humidityRange) {
        const [min, max] = options.humidityRange.split(',').map(parseFloat);
        rules.humidity = { min, max };
      }
      
      if (options.gapMinutes) {
        rules.sensorGapMinutes = parseInt(options.gapMinutes);
      }
      
      if (options.recoveryMinutes) {
        rules.doorRecoveryMinutes = parseInt(options.recoveryMinutes);
      }

      console.log(chalk.yellow('配置参数:'));
      console.log(`  温度范围: ${rules.temperature.min}-${rules.temperature.max}°C`);
      console.log(`  湿度范围: ${rules.humidity.min}-${rules.humidity.max}%`);
      console.log(`  传感器断点阈值: ${rules.sensorGapMinutes} 分钟`);
      console.log(`  开门恢复阈值: ${rules.doorRecoveryMinutes} 分钟\n`);

      console.log(chalk.yellow('解析设备数据...'));
      const deviceRecords = parsePath(options.device, 'device');
      console.log(chalk.green(`  解析完成，共 ${deviceRecords.length} 条设备记录`));

      console.log(chalk.yellow('解析批次数据...'));
      const batchRecords = parsePath(options.batch, 'batch');
      console.log(chalk.green(`  解析完成，共 ${batchRecords.length} 条批次记录\n`));

      console.log(chalk.yellow('合并数据...'));
      const mergedRecords = mergeRecords(deviceRecords, batchRecords);
      console.log(chalk.green(`  合并完成，共 ${mergedRecords.length} 条记录\n`));

      console.log(chalk.yellow('检测异常...'));
      const anomalies = checkAllAnomalies(deviceRecords, batchRecords, rules);
      const anomalySummary = getAnomalySummary(anomalies);
      console.log(chalk.green(`  检测完成，共 ${anomalySummary.total} 个异常\n`));

      console.log(chalk.yellow('异常统计:'));
      console.log(`  按类型: ${JSON.stringify(anomalySummary.byType)}`);
      console.log(`  按严重程度: ${JSON.stringify(anomalySummary.bySeverity)}`);
      console.log(`  按箱号: ${JSON.stringify(anomalySummary.byBoxId)}\n`);

      const outputDir = options.output || join(process.cwd(), 'output');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const markdownPath = join(outputDir, `report-${timestamp}.md`);
      const csvPath = join(outputDir, `summary-${timestamp}.csv`);
      const reviewPath = join(outputDir, `review-${timestamp}.md`);

      const result = {
        processedAt: new Date().toISOString(),
        deviceFiles: getFilesFromPath(options.device),
        batchFiles: getFilesFromPath(options.batch),
        totalDeviceRecords: deviceRecords.length,
        totalBatchRecords: batchRecords.length,
        mergedRecordsCount: mergedRecords.length,
        anomalies: anomalies,
        anomalySummary: anomalySummary,
        boxIds: [...new Set(deviceRecords.map(r => r.boxId))].sort(),
        batchIds: [...new Set(batchRecords.map(r => r.batchId))].sort(),
        reportOutputs: {
          markdown: markdownPath,
          csv: csvPath,
          review: reviewPath
        }
      };

      console.log(chalk.yellow('生成报告...'));
      generateMarkdownReport(result, markdownPath);
      console.log(chalk.green(`  Markdown报告: ${markdownPath}`));

      generateCSVSummary(result, csvPath);
      console.log(chalk.green(`  CSV摘要: ${csvPath}`));

      generateReviewList(result, reviewPath);
      console.log(chalk.green(`  待复核清单: ${reviewPath}\n`));

      console.log(chalk.yellow('保存处理历史...'));
      const recordId = storage.saveProcessingResult(result);
      console.log(chalk.green(`  已保存，记录ID: ${recordId}\n`));

      console.log(chalk.green('=== 处理完成 ===\n'));
      console.log(chalk.blue('提示: 可以使用以下命令查询历史记录:'));
      console.log(`  incubator-log query --box-id <箱号>`);
      console.log(`  incubator-log query --batch-id <批次号>`);
      console.log(`  incubator-log list`);

    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program
  .command('query')
  .description('查询处理历史记录')
  .option('--id <id>', '按记录ID查询')
  .option('--box-id <boxId>', '按箱号查询')
  .option('--batch-id <batchId>', '按批次号查询')
  .option('--date <date>', '按日期查询 (格式: YYYY-MM-DD)')
  .option('--start-date <date>', '日期范围起始')
  .option('--end-date <date>', '日期范围结束')
  .option('--json', '以JSON格式输出')
  .action(async (options) => {
    try {
      let records = [];

      if (options.id) {
        const record = storage.getRecordById(options.id);
        if (record) {
          records = [record];
        }
      } else if (options.boxId) {
        records = storage.getRecordsByBoxId(options.boxId);
      } else if (options.batchId) {
        records = storage.getRecordsByBatchId(options.batchId);
      } else if (options.date) {
        records = storage.getRecordsByDate(options.date);
      } else if (options.startDate && options.endDate) {
        records = storage.getRecordsByDateRange(options.startDate, options.endDate);
      } else {
        console.log(chalk.yellow('请提供查询条件: --id, --box-id, --batch-id, --date, 或 --start-date 与 --end-date'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(records, null, 2));
        return;
      }

      if (records.length === 0) {
        console.log(chalk.yellow('未找到匹配的记录'));
        return;
      }

      console.log(chalk.blue(`=== 查询结果 (共 ${records.length} 条) ===\n`));

      for (const record of records) {
        console.log(chalk.yellow(`记录ID: ${record.id}`));
        console.log(`  处理时间: ${new Date(record.processedAt).toLocaleString('zh-CN')}`);
        console.log(`  设备记录: ${record.totalDeviceRecords || 0} 条`);
        console.log(`  批次记录: ${record.totalBatchRecords || 0} 条`);
        console.log(`  异常数量: ${record.anomalySummary?.total || 0}`);
        console.log(`  涉及箱号: ${(record.boxIds || []).join(', ') || '-'}`);
        console.log(`  涉及批次: ${(record.batchIds || []).join(', ') || '-'}`);
        console.log();
      }

    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有箱号、批次号和日期索引')
  .option('--json', '以JSON格式输出')
  .action(async (options) => {
    try {
      const boxIds = storage.listAllBoxIds();
      const batchIds = storage.listAllBatchIds();
      const dates = storage.listAllDates();

      if (options.json) {
        console.log(JSON.stringify({ boxIds, batchIds, dates }, null, 2));
        return;
      }

      console.log(chalk.blue('=== 索引列表 ===\n'));

      console.log(chalk.yellow('箱号:'));
      if (boxIds.length > 0) {
        console.log(`  ${boxIds.join(', ')}`);
      } else {
        console.log(`  (无记录)`);
      }

      console.log();
      console.log(chalk.yellow('批次号:'));
      if (batchIds.length > 0) {
        console.log(`  ${batchIds.join(', ')}`);
      } else {
        console.log(`  (无记录)`);
      }

      console.log();
      console.log(chalk.yellow('处理日期:'));
      if (dates.length > 0) {
        console.log(`  ${dates.join(', ')}`);
      } else {
        console.log(`  (无记录)`);
      }

    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('delete')
  .description('删除处理历史记录')
  .option('--id <id>', '要删除的记录ID')
  .option('--all', '删除所有记录')
  .option('--force', '强制删除，不确认')
  .action(async (options) => {
    try {
      if (!options.id && !options.all) {
        console.log(chalk.yellow('请提供 --id 或 --all 参数'));
        return;
      }

      if (options.all) {
        if (!options.force) {
          console.log(chalk.yellow('此操作将删除所有历史记录。请使用 --force 参数确认。'));
          return;
        }
        storage.clearAll();
        console.log(chalk.green('已删除所有历史记录'));
        return;
      }

      const deleted = storage.deleteRecord(options.id);
      if (deleted) {
        console.log(chalk.green(`已删除记录: ${options.id}`));
      } else {
        console.log(chalk.yellow(`未找到记录: ${options.id}`));
      }

    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

function parsePath(path, type) {
  if (!existsSync(path)) {
    throw new Error(`路径不存在: ${path}`);
  }

  const stat = statSync(path);
  
  if (stat.isDirectory()) {
    return parseDirectory(path, type);
  } else if (stat.isFile()) {
    return type === 'device' 
      ? parseDeviceCSV(path)
      : parseBatchCSV(path);
  }
  
  return [];
}

function getFilesFromPath(path) {
  if (!existsSync(path)) return [];
  
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  
  if (stat.isDirectory()) {
    return readdirSync(path)
      .filter(f => f.toLowerCase().endsWith('.csv'))
      .map(f => join(path, f));
  }
  
  return [];
}

program.parse(process.argv);
