#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import { FileProcessor } from './file-processor';

const program = new Command();

program
  .name('court-compensation')
  .description('篮球场预约处球场天气补偿 CLI 工具')
  .version('1.0.0');

const defaultInput = path.join(__dirname, '..', 'samples', 'sample-data.csv');
const defaultOutput = path.join(__dirname, '..', 'output');
const defaultRules = path.join(__dirname, '..', 'config', 'rules.json');

program
  .command('preview')
  .description('预览模式 - 仅显示处理结果，不写入文件')
  .option('-i, --input <path>', '输入CSV文件路径', defaultInput)
  .option('-o, --output <path>', '输出目录路径', defaultOutput)
  .option('-r, --rules <path>', '规则配置文件路径', defaultRules)
  .action((options) => {
    try {
      const processor = new FileProcessor({
        input: path.resolve(options.input),
        outputDir: path.resolve(options.output),
        mode: 'preview',
        rulesPath: path.resolve(options.rules),
      });
      processor.run();
    } catch (error) {
      console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('正式模式 - 处理并写入输出文件')
  .option('-i, --input <path>', '输入CSV文件路径', defaultInput)
  .option('-o, --output <path>', '输出目录路径', defaultOutput)
  .option('-r, --rules <path>', '规则配置文件路径', defaultRules)
  .action((options) => {
    try {
      const processor = new FileProcessor({
        input: path.resolve(options.input),
        outputDir: path.resolve(options.output),
        mode: 'run',
        rulesPath: path.resolve(options.rules),
      });
      processor.run();
    } catch (error) {
      console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error('❌ 命令执行失败:', error instanceof Error ? error.message : error);
  process.exit(1);
});
