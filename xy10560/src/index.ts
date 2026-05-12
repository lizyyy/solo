#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { importCommand } from './commands/import';
import { checkCommand } from './commands/check';
import { detailCommand } from './commands/detail';
import { reportCommand } from './commands/report';

const program = new Command();

program
  .name('cert-rotator')
  .description('批量证书换发 CLI 工具 - 管理内部服务证书临期换发')
  .version('1.0.0');

program
  .command('init')
  .description('初始化数据存储')
  .option('--store-path <path>', '指定存储文件路径')
  .action((options) => {
    initCommand(options);
  });

program
  .command('import')
  .description('导入证书和相关数据')
  .option('--store-path <path>', '指定存储文件路径')
  .option('--sample', '加载内置样例数据')
  .option('--failure', '加载失败场景样例数据')
  .option('--file <path>', '从 JSON 文件导入数据')
  .option('--overwrite', '覆盖已存在的重复记录')
  .option('--operator <name>', '操作者名称', 'system')
  .action((options) => {
    importCommand(options);
  });

program
  .command('check')
  .description('检查证书状态')
  .option('--store-path <path>', '指定存储文件路径')
  .option('--environment <env>', '按环境筛选 (test|preprod|production)')
  .option('--certificate-id <id>', '检查指定证书')
  .option('--verbose', '显示详细信息')
  .option('--operator <name>', '操作者名称', 'system')
  .action((options) => {
    checkCommand(options);
  });

program
  .command('detail')
  .description('查看证书详细信息和执行历史')
  .requiredOption('--certificate-id <id>', '证书 ID')
  .option('--store-path <path>', '指定存储文件路径')
  .option('--operator <name>', '操作者名称', 'system')
  .action((options) => {
    detailCommand(options);
  });

program
  .command('report')
  .description('生成证书换发报告')
  .option('--store-path <path>', '指定存储文件路径')
  .option('--history <n>', '显示最近 N 条执行记录', parseInt)
  .option('--json', '以 JSON 格式输出')
  .option('--operator <name>', '操作者名称', 'system')
  .action((options) => {
    reportCommand(options);
  });

program.parse(process.argv);
