#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const initCommand = require('../src/commands/init');
const importCommand = require('../src/commands/import');
const checkCommand = require('../src/commands/check');
const detailCommand = require('../src/commands/detail');
const reportCommand = require('../src/commands/report');
const { getWorkspaceStatus } = require('../src/utils/workspace');

program
  .name('cold-chain')
  .description('冷库温控告警归档 CLI')
  .version('1.0.0');

program.hook('preAction', (thisCommand, actionCommand) => {
  if (actionCommand.name() !== 'init') {
    const status = getWorkspaceStatus();
    if (!status.initialized) {
      console.error(chalk.red('错误: 工作目录未初始化。请先运行 "cold-chain init" 命令。'));
      process.exit(1);
    }
  }
});

program
  .command('init')
  .description('初始化工作目录')
  .option('--force', '强制重新初始化，将覆盖现有数据')
  .action(initCommand);

program
  .command('import')
  .description('导入数据文件')
  .option('--type <type>', '数据类型: temperature|door|maintenance|batch')
  .option('--file <path>', '数据文件路径 (JSON格式)')
  .option('--sample', '导入内置样例数据')
  .action(importCommand);

program
  .command('check')
  .description('检查告警并归档')
  .option('--id <alertId>', '检查指定告警ID')
  .option('--all', '检查所有未处理告警')
  .option('--force', '强制重新检查已处理的告警')
  .action(checkCommand);

program
  .command('detail')
  .description('查看告警详情')
  .argument('<alertId>', '告警ID')
  .option('--history', '显示历史记录')
  .action(detailCommand);

program
  .command('report')
  .description('生成报告')
  .option('--type <type>', '报告类型: summary|batch|risk')
  .option('--output <path>', '输出文件路径')
  .option('--format <format>', '输出格式: json|text', 'text')
  .action(reportCommand);

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('错误: ' + err.message));
  process.exit(1);
});
