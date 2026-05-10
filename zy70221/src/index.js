#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const program = new Command();

program
  .name('vending-transfer')
  .description('售货机临期品调拨 CLI 工具 - 管理多点位临期商品调拨和降价')
  .version('1.0.0');

program
  .command('init')
  .description('初始化样例数据和环境')
  .option('--force', '强制覆盖现有数据')
  .action(require('./commands/init'));

program
  .command('import')
  .description('导入数据文件')
  .argument('<file>', '要导入的文件路径')
  .option('-t, --type <type>', '数据类型: locations|products|inventory|expiry-scans', 'inventory')
  .option('-d, --dry-run', '试运行，不实际导入')
  .action(require('./commands/import'));

program
  .command('check')
  .description('执行检查：验证库存、效期和调拨建议')
  .option('-l, --location <id>', '只检查指定点位')
  .option('-v, --verbose', '显示详细信息')
  .option('--fix', '自动修复可修复的问题')
  .action(require('./commands/check'));

program
  .command('history')
  .description('查看历史检查记录')
  .option('-n, --limit <number>', '显示最近N条记录', '10')
  .option('-a, --all', '显示所有记录')
  .option('--id <id>', '查看特定检查记录详情')
  .action(require('./commands/history'));

program
  .command('export')
  .description('导出检查结果')
  .option('-t, --type <type>', '导出类型: all|issues|transfers|expiring', 'all')
  .option('-f, --format <format>', '输出格式: csv|json', 'csv')
  .option('-o, --output <path>', '输出文件路径')
  .option('--check-id <id>', '导出特定检查记录')
  .action(require('./commands/export'));

program
  .addHelpText('after', `

示例:
  ${chalk.cyan('$ vending-transfer init')}                  初始化样例数据
  ${chalk.cyan('$ vending-transfer import data.csv')}       导入库存数据
  ${chalk.cyan('$ vending-transfer check')}                  执行全面检查
  ${chalk.cyan('$ vending-transfer check -l LOC001')}        检查指定点位
  ${chalk.cyan('$ vending-transfer history')}                查看历史记录
  ${chalk.cyan('$ vending-transfer export -t issues')}       导出问题清单
`);

program.parseAsync(process.argv)
  .catch((err) => {
    console.error(chalk.red('执行出错:'), err.message);
    process.exit(1);
  });
