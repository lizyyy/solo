#!/usr/bin/env node

import { program } from 'commander';
import { runValidate } from './commands/validate';
import { runReview } from './commands/review';
import { runExport } from './commands/export';
import * as path from 'path';

const packageInfo = require('../package.json');

program
  .name('linen-audit')
  .description('连锁酒店布草洗涤流转夜审复核CLI工具')
  .version(packageInfo.version);

program
  .command('validate')
  .description('验证布草洗涤流转数据，检查严重问题')
  .argument('[dataDir]', '数据目录路径', './data')
  .option('-v, --verbose', '显示详细信息，包括信息类提示')
  .action(async (dataDir: string, options: { verbose?: boolean }) => {
    const exitCode = await runValidate(dataDir, options);
    process.exit(exitCode);
  });

program
  .command('review')
  .description('进行完整的夜审复核，生成详细报告')
  .argument('[dataDir]', '数据目录路径', './data')
  .option('-d, --detailed', '显示详细汇总信息')
  .option('-v, --verbose', '显示所有问题的详细信息')
  .action(async (dataDir: string, options: { detailed?: boolean; verbose?: boolean }) => {
    const exitCode = await runReview(dataDir, options);
    process.exit(exitCode);
  });

program
  .command('export')
  .description('导出复核结果到文件 (issues.csv 和 linen_review.md)')
  .argument('[dataDir]', '数据目录路径', './data')
  .option('-o, --output <outputDir>', '输出目录路径，默认为数据目录')
  .action(async (dataDir: string, options: { output?: string }) => {
    const exitCode = await runExport(dataDir, options);
    process.exit(exitCode);
  });

program.on('command:*', (commands) => {
  console.error(`❌ 未知命令: ${commands[0]}`);
  console.error('');
  console.error('可用命令:');
  console.error('  validate  - 验证布草洗涤流转数据');
  console.error('  review    - 进行完整的夜审复核');
  console.error('  export    - 导出复核结果到文件');
  console.error('');
  console.error('使用 linen-audit --help 查看更多帮助');
  process.exit(1);
});

program.parse(process.argv);
