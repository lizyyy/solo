#!/usr/bin/env node

import { Command } from 'commander';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { LifecycleSimulator } from './core/simulator';
import { OutputGenerator } from './output/generator';
import { CliOptions } from './types';

const packageJson = require('../package.json');

const program = new Command();

program
  .name('lifecycle-sim')
  .description('对象存储生命周期规则预演CLI工具')
  .version(packageJson.version);

program
  .command('run', { isDefault: true })
  .description('运行生命周期预演')
  .requiredOption('-i, --input <path>', '对象清单输入路径（CSV文件或目录）')
  .requiredOption('-r, --rules <path>', '生命周期规则文件路径（YAML/JSON）')
  .option('-o, --output <path>', '输出目录', './output')
  .option('-d, --date <date>', '预演日期（YYYY-MM-DD），默认今天')
  .option('-f, --format <format>', '输出格式: all,summary,csv,markdown', 'all')
  .option('-v, --verbose', '显示详细输出')
  .option('-q, --quiet', '静默模式，只输出错误')
  .action(async (options: CliOptions) => {
    try {
      validateOptions(options);
      
      if (!options.quiet) {
        console.log(chalk.blue('='.repeat(60)));
        console.log(chalk.blue('  对象存储生命周期预演工具'));
        console.log(chalk.blue('='.repeat(60)));
        console.log();
      }

      ensureOutputDir(options.output);

      const simulator = new LifecycleSimulator();
      const result = simulator.run(options);

      const generator = new OutputGenerator(options);
      generator.generateAll(result);

      if (!options.quiet) {
        console.log();
        console.log(chalk.green('✓ 预演完成！'));
        console.log(chalk.gray(`输出目录: ${path.resolve(options.output)}`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red('\n✗ 执行失败:'));
      console.error(chalk.red(`  ${error instanceof Error ? error.message : String(error)}`));
      
      if (options.verbose && error instanceof Error && error.stack) {
        console.error(chalk.gray('\n堆栈跟踪:'));
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  });

function validateOptions(options: CliOptions): void {
  if (!fs.existsSync(options.input)) {
    throw new Error(`输入路径不存在: ${options.input}`);
  }

  if (!fs.existsSync(options.rules)) {
    throw new Error(`规则文件不存在: ${options.rules}`);
  }

  const validFormats = ['all', 'summary', 'csv', 'markdown'];
  if (!validFormats.includes(options.format)) {
    throw new Error(`无效的输出格式: ${options.format}，可选值: ${validFormats.join(', ')}`);
  }

  if (!options.quiet) {
    console.log(chalk.gray(`输入路径: ${options.input}`));
    console.log(chalk.gray(`规则文件: ${options.rules}`));
    console.log(chalk.gray(`输出目录: ${options.output}`));
    if (options.date) {
      console.log(chalk.gray(`预演日期: ${options.date}`));
    }
    console.log();
  }
}

function ensureOutputDir(outputPath: string): void {
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }
}

program.parse();
