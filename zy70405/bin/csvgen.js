#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateRecords, saveToCsv, saveFailures } from '../src/generator.js';
import { queryRecords, getFailures, getBoundaryRecords, getReminderList, getBatches } from '../src/query.js';
import { formatJson, formatMarkdown, saveJson, saveMarkdown, formatConsole } from '../src/formatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch (e) {
    await fs.mkdir(dir, { recursive: true });
  }
}

program
  .name('csvgen')
  .description('CSV 压测生成器 - 过期版本冻结通知')
  .version('1.0.0');

program
  .command('generate')
  .description('生成测试数据')
  .option('-c, --count <number>', '生成记录数', '100')
  .option('-d, --dirty-ratio <number>', '脏数据比例', '0.1')
  .option('-o, --output <path>', '输出目录', './data')
  .option('--format <type>', '输出格式: csv,json,md,all', 'all')
  .action(async function(options) {
    try {
      const count = parseInt(options.count);
      const dirtyRatio = parseFloat(options.dirtyRatio);
      const outputDir = path.resolve(options.output);
      
      await ensureDir(outputDir);
      
      console.log('正在生成 ' + count + ' 条记录（脏数据比例: ' + (dirtyRatio * 100) + '%）...');
      const data = await generateRecords(count, dirtyRatio);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = 'freeze-' + data.batchId + '-' + timestamp;
      
      if (options.format === 'csv' || options.format === 'all') {
        const csvPath = path.join(outputDir, baseName + '.csv');
        await saveToCsv(data, csvPath);
        console.log('CSV 已保存: ' + csvPath);
        
        const failuresPath = path.join(outputDir, baseName + '-failures.csv');
        const savedPath = await saveFailures(data, failuresPath);
        if (savedPath) {
          console.log('失败项已保存: ' + savedPath);
        }
      }
      
      if (options.format === 'json' || options.format === 'all') {
        const jsonPath = path.join(outputDir, baseName + '.json');
        await saveJson(data, jsonPath);
        console.log('JSON 已保存: ' + jsonPath);
      }
      
      if (options.format === 'md' || options.format === 'all') {
        const mdPath = path.join(outputDir, baseName + '.md');
        await saveMarkdown(data, mdPath, '过期版本冻结通知 - 测试数据');
        console.log('Markdown 已保存: ' + mdPath);
      }
      
      console.log('\n完成! 批次ID: ' + data.batchId);
      console.log('总记录数: ' + data.totalCount + ', 脏数据: ' + data.dirtyCount);
      
    } catch (error) {
      console.error('生成失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('query')
  .description('查询历史记录')
  .option('-i, --input <path>', '数据目录', './data')
  .option('--batch <id>', '按批次ID过滤')
  .option('--operator <name>', '按操作者过滤')
  .option('--risk <type>', '按风险类型过滤')
  .option('--status <status>', '按状态过滤')
  .option('--dirty', '只显示脏数据')
  .option('--boundary', '只显示边界输入')
  .option('--format <type>', '输出格式: console,json,md', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async function(options) {
    try {
      const dataDir = path.resolve(options.input);
      
      const filters = {
        batchId: options.batch,
        operator: options.operator,
        riskType: options.risk,
        status: options.status,
        isDirty: options.dirty ? true : undefined,
        isBoundary: options.boundary ? true : undefined
      };
      
      const isConsoleOutput = options.format === 'console' || (options.format === 'json' && !options.output) || (options.format === 'md' && !options.output);
      if (options.format === 'console' || (options.format !== 'json' && options.format !== 'md')) {
        console.log('正在查询...');
      }
      
      const result = await queryRecords(dataDir, filters);
      
      if (options.format === 'console') {
        formatConsole(result);
      } else if (options.format === 'json') {
        if (options.output) {
          await saveJson(result, options.output);
          console.log('JSON 已保存: ' + options.output);
        } else {
          console.log(formatJson(result));
        }
      } else if (options.format === 'md') {
        if (options.output) {
          await saveMarkdown(result, options.output, '查询结果');
          console.log('Markdown 已保存: ' + options.output);
        } else {
          console.log(formatMarkdown(result, '查询结果'));
        }
      }
      
    } catch (error) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('failures')
  .description('查看所有失败项')
  .option('-i, --input <path>', '数据目录', './data')
  .option('--format <type>', '输出格式: console,json,md', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async function(options) {
    try {
      const dataDir = path.resolve(options.input);
      const result = await getFailures(dataDir);
      
      if (options.format === 'console') {
        formatConsole(result);
      } else if (options.format === 'json') {
        if (options.output) {
          await saveJson(result, options.output);
          console.log('JSON 已保存: ' + options.output);
        } else {
          console.log(formatJson(result));
        }
      } else if (options.format === 'md') {
        if (options.output) {
          await saveMarkdown(result, options.output, '失败项列表');
          console.log('Markdown 已保存: ' + options.output);
        } else {
          console.log(formatMarkdown(result, '失败项列表'));
        }
      }
      
    } catch (error) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('boundary')
  .description('查看边界输入记录')
  .option('-i, --input <path>', '数据目录', './data')
  .option('--format <type>', '输出格式: console,json,md', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async function(options) {
    try {
      const dataDir = path.resolve(options.input);
      const result = await getBoundaryRecords(dataDir);
      
      if (options.format === 'console') {
        formatConsole(result);
      } else if (options.format === 'json') {
        if (options.output) {
          await saveJson(result, options.output);
          console.log('JSON 已保存: ' + options.output);
        } else {
          console.log(formatJson(result));
        }
      } else if (options.format === 'md') {
        if (options.output) {
          await saveMarkdown(result, options.output, '边界输入记录');
          console.log('Markdown 已保存: ' + options.output);
        } else {
          console.log(formatMarkdown(result, '边界输入记录'));
        }
      }
      
    } catch (error) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('reminders')
  .description('查看审批催办列表（复盘用）')
  .option('-i, --input <path>', '数据目录', './data')
  .option('--format <type>', '输出格式: console,json,md', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async function(options) {
    try {
      const dataDir = path.resolve(options.input);
      const result = await getReminderList(dataDir);
      
      if (options.format === 'console') {
        console.log('\n========================================');
        console.log('查询时间: ' + result.queryTime);
        console.log('催办记录总数: ' + result.totalCount);
        console.log('========================================\n');
        
        for (let i = 0; i < result.records.length; i++) {
          const record = result.records[i];
          console.log(record.id + ' - ' + record.system);
          console.log('  操作者: ' + record.operator + ', 当前状态: ' + record.status);
          console.log('  催办次数: ' + record.reminderCount);
          for (let j = 0; j < record.reminders.length; j++) {
            const reminder = record.reminders[j];
            console.log('    - ' + reminder.time.slice(0, 16) + ': ' + reminder.remark);
          }
          console.log('');
        }
      } else if (options.format === 'json') {
        if (options.output) {
          await saveJson(result, options.output);
          console.log('JSON 已保存: ' + options.output);
        } else {
          console.log(formatJson(result));
        }
      } else if (options.format === 'md') {
        if (options.output) {
          await saveMarkdown(result, options.output, '审批催办列表');
          console.log('Markdown 已保存: ' + options.output);
        } else {
          console.log(formatMarkdown(result, '审批催办列表'));
        }
      }
      
    } catch (error) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('batches')
  .description('查看所有批次')
  .option('-i, --input <path>', '数据目录', './data')
  .option('--format <type>', '输出格式: console,json,md', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .action(async function(options) {
    try {
      const dataDir = path.resolve(options.input);
      const result = await getBatches(dataDir);
      
      if (options.format === 'console') {
        console.log('\n========================================');
        console.log('查询时间: ' + result.queryTime);
        console.log('批次总数: ' + result.totalCount);
        console.log('========================================\n');
        
        for (let i = 0; i < result.batches.length; i++) {
          const batch = result.batches[i];
          console.log(batch.batchId);
          console.log('  记录数: ' + batch.recordCount + ', 失败: ' + batch.failureCount + ', 脏数据: ' + batch.dirtyCount + ', 边界: ' + batch.boundaryCount);
          console.log('  操作者: ' + batch.operators.join(', '));
          console.log('  风险类型: ' + batch.riskTypes.join(', '));
          console.log('');
        }
      } else if (options.format === 'json') {
        if (options.output) {
          await saveJson(result, options.output);
          console.log('JSON 已保存: ' + options.output);
        } else {
          console.log(formatJson(result));
        }
      } else if (options.format === 'md') {
        if (options.output) {
          await saveMarkdown(result, options.output, '批次列表');
          console.log('Markdown 已保存: ' + options.output);
        } else {
          console.log(formatMarkdown(result, '批次列表'));
        }
      }
      
    } catch (error) {
      console.error('查询失败:', error.message);
      process.exit(1);
    }
  });

program.parse();
