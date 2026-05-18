#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from './config.js';
import LogParser from './parser.js';
import LogProcessor from './processor.js';
import ResultWriter from './writer.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('access-log-audit')
  .description('共享会议室门禁日志核对CLI工具')
  .version('1.0.0')
  .option('-c, --config <path>', '配置文件路径')
  .option('-i, --input <directory>', '输入目录，覆盖配置中的input.directory')
  .option('-o, --output <directory>', '输出目录，覆盖配置中的output.directory')
  .option('--no-deduplication', '禁用去重功能')
  .option('--no-crossday', '禁用跨天检测')
  .option('--no-retransmission', '禁用补传检测')
  .action(async (options) => {
    try {
      await runAudit(options);
    } catch (error) {
      console.error('核对过程中发生错误:', error.message);
      process.exit(1);
    }
  });

async function runAudit(options) {
  console.log('='.repeat(60));
  console.log('共享会议室门禁日志核对工具');
  console.log('='.repeat(60));
  console.log('');

  const configPath = options.config ? path.resolve(options.config) : null;
  const config = loadConfig(configPath);

  if (options.input) {
    config.input.directory = options.input;
  }
  if (options.output) {
    config.output.directory = options.output;
  }

  if (options.deduplication === false) {
    config.rules.deduplication.enabled = false;
  }
  if (options.crossday === false) {
    config.rules.crossDay.enabled = false;
  }
  if (options.retransmission === false) {
    config.rules.retransmission.enabled = false;
  }

  console.log('配置信息:');
  console.log(`  输入目录: ${path.resolve(config.input.directory)}`);
  console.log(`  输出目录: ${path.resolve(config.output.directory)}`);
  console.log(`  文件模式: ${config.input.filePattern}`);
  console.log('');
  console.log('功能状态:');
  console.log(`  去重功能: ${config.rules.deduplication.enabled ? '启用' : '禁用'}`);
  console.log(`  跨天检测: ${config.rules.crossDay.enabled ? '启用' : '禁用'}`);
  console.log(`  补传检测: ${config.rules.retransmission.enabled ? '启用' : '禁用'}`);
  console.log('');
  console.log('开始处理...');
  console.log('');

  const parser = new LogParser(config);
  const parseResult = await parser.parseDirectory(config.input.directory);

  const allRecords = parseResult.results.flatMap(r => r.records);

  const processor = new LogProcessor(config);
  
  const writer = new ResultWriter(config);
  const existingHashes = writer.loadProcessedHashes();
  processor.loadProcessedHashes(existingHashes);

  const processResult = processor.process(allRecords);

  await writer.writeResults(processResult, parseResult);

  console.log('');
  console.log('核对完成！输出文件已保存到:', path.resolve(config.output.directory));
  console.log('');
  console.log('生成的文件:');
  console.log(`  - ${config.output.auditResult} (核对结果)`);
  if (processResult.crossDayRecords.length > 0) {
    console.log(`  - ${config.output.crossDayRecords} (跨天记录)`);
  }
  if (processResult.retransmittedRecords.length > 0) {
    console.log(`  - ${config.output.retransmittedRecords} (补传记录)`);
  }
  if (processResult.deduplicatedRecords.length > 0) {
    console.log(`  - ${config.output.deduplicatedRecords} (去重记录)`);
  }
  if (parseResult.errors.length > 0) {
    console.log(`  - ${config.output.errorReport} (错误报告)`);
  }
  console.log('  - summary.txt (汇总报告)');
  console.log('  - .processed_hashes.json (已处理记录哈希，用于去重)');
  console.log('');
}

program.parse(process.argv);
