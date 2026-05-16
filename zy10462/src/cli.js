#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { runMigration } = require('./index');

const program = new Command();

program
  .name('anchor-migrate')
  .description('Markdown锚点迁移CLI工具 - 检测并修复文档标题变更导致的断链')
  .version('1.0.0')
  .option('-i, --input <directory>', '输入目录或文件路径', process.cwd())
  .option('-o, --output <directory>', '输出报告目录', './anchor-migration-report')
  .option('--fix', '启用自动修复预览模式（不实际修改文件）')
  .option('--apply-fix', '实际应用自动修复（谨慎使用）')
  .option('--pattern <glob>', 'Markdown文件匹配模式', '**/*.md')
  .option('--exclude <patterns>', '排除的目录或文件模式（逗号分隔）', 'node_modules,.git')
  .option('--verbose', '显示详细日志')
  .option('--no-clean', '不清空输出目录，保留历史报告')
  .parse(process.argv);

const options = program.opts();

function validateOptions(options) {
  const errors = [];

  if (!fs.existsSync(options.input)) {
    errors.push(`输入路径不存在: ${options.input}`);
  }

  const inputStats = fs.statSync(options.input);
  if (!inputStats.isDirectory() && !inputStats.isFile()) {
    errors.push(`输入路径必须是目录或文件: ${options.input}`);
  }

  if (options.applyFix && !options.fix) {
    errors.push('使用 --apply-fix 时必须同时使用 --fix');
  }

  return errors;
}

async function main() {
  console.log(chalk.bold('\n🔍 Markdown锚点迁移CLI工具\n'));

  const validationErrors = validateOptions(options);
  if (validationErrors.length > 0) {
    console.error(chalk.red('❌ 参数校验失败:'));
    validationErrors.forEach(err => console.error(chalk.red(`   - ${err}`)));
    console.error();
    process.exit(1);
  }

  options.input = path.resolve(options.input);
  options.output = path.resolve(options.output);
  options.exclude = options.exclude.split(',').map(p => p.trim());

  console.log(chalk.blue('📋 配置信息:'));
  console.log(`   输入路径: ${chalk.cyan(options.input)}`);
  console.log(`   输出目录: ${chalk.cyan(options.output)}`);
  console.log(`   文件模式: ${chalk.cyan(options.pattern)}`);
  console.log(`   排除模式: ${chalk.cyan(options.exclude.join(', '))}`);
  console.log(`   修复模式: ${chalk.cyan(options.fix ? (options.applyFix ? '应用修复' : '预览模式') : '仅检测')}`);
  console.log();

  try {
    await runMigration(options);
  } catch (error) {
    console.error(chalk.red('\n❌ 执行失败:'), error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
