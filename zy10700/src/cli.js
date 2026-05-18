#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { processLogs } = require('./processor');
const { writeResults } = require('./output');

const program = new Command();

program
  .name('gateway-rate-limit-attribution')
  .description('网关访问日志限流命中归因 CLI - 按租户和接口聚合限流命中原因，检测时钟漂移、网关重试、规则版本不一致等特殊情况')
  .version('1.0.0');

program
  .requiredOption('-i, --input <path>', '输入日志文件路径（支持 .jsonl 或 .csv）')
  .requiredOption('-r, --rules <path>', '限流规则文件路径（.json）')
  .requiredOption('-o, --output <dir>', '输出目录路径')
  .option('--dry-run', '试运行，不写入文件', false)
  .option('--overwrite', '覆盖已存在的输出文件', false)
  .action(async (options) => {
    try {
      validateOptions(options);
      
      console.log('=== 网关访问日志限流命中归因 CLI ===');
      console.log(`输入文件: ${options.input}`);
      console.log(`规则文件: ${options.rules}`);
      console.log(`输出目录: ${options.output}`);
      console.log(`试运行: ${options.dryRun ? '是' : '否'}`);
      console.log(`覆盖模式: ${options.overwrite ? '是' : '否'}`);
      console.log('');

      const results = await processLogs(options.input, options.rules);
      
      if (!options.dryRun) {
        await writeResults(results, options.output, options.overwrite);
        console.log('');
        console.log(`✅ 处理完成！结果已输出到: ${options.output}`);
      } else {
        console.log('');
        console.log('📋 试运行模式 - 结果预览:');
        console.log(JSON.stringify(results.summary, null, 2));
      }
    } catch (error) {
      console.error('❌ 处理失败:', error.message);
      process.exit(1);
    }
  });

function validateOptions(options) {
  if (!fs.existsSync(options.input)) {
    throw new Error(`输入文件不存在: ${options.input}`);
  }
  if (!fs.existsSync(options.rules)) {
    throw new Error(`规则文件不存在: ${options.rules}`);
  }
  if (!options.dryRun) {
    if (fs.existsSync(options.output) && !options.overwrite) {
      const files = fs.readdirSync(options.output);
      if (files.length > 0) {
        throw new Error(`输出目录已存在且不为空，请使用 --overwrite 选项或指定其他目录`);
      }
    }
  }
}

program.parse();
