#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const commands = require('./lib/commands');

const program = new Command();

program
  .name('club-reimburse')
  .description('校园社团经费票据 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化工作目录并加载样例数据')
  .action(() => {
    commands.handleInit();
  });

program
  .command('import')
  .description('导入数据文件')
  .argument('<file>', '数据文件路径 (.json 或 .csv)')
  .requiredOption('-t, --type <type>', '数据类型: budget, invoice, approval')
  .action((file, options) => {
    commands.handleImport(file, options.type);
  });

program
  .command('check')
  .description('执行数据校验，检查预算、票据和审批的一致性')
  .action(() => {
    commands.handleCheck();
  });

program
  .command('history')
  .description('查看校验历史')
  .option('-l, --limit <number>', '显示最近的记录数', '5')
  .action((options) => {
    commands.handleHistory(parseInt(options.limit));
  });

program
  .command('export')
  .description('导出最近一次的校验结果')
  .argument('<output>', '输出文件路径')
  .option('-f, --format <format>', '导出格式: json, csv', 'json')
  .action((output, options) => {
    commands.handleExport(output, options.format);
  });

program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    showHelp();
  });

function showHelp() {
  console.log('');
  console.log(chalk.bold(chalk.cyan('═══════════════════════════════════════')));
  console.log(chalk.bold(chalk.cyan('  校园社团经费票据 CLI 工具 - 使用说明')));
  console.log(chalk.bold(chalk.cyan('═══════════════════════════════════════')));
  console.log('');
  console.log(chalk.bold('可用命令:'));
  console.log('');
  console.log(chalk.yellow('  init'));
  console.log('    初始化工作目录并加载样例数据');
  console.log('');
  console.log(chalk.yellow('  import <file> -t <type>'));
  console.log('    导入数据文件');
  console.log('    -t, --type: 数据类型 (budget, invoice, approval)');
  console.log('');
  console.log(chalk.yellow('  check'));
  console.log('    执行数据校验');
  console.log('');
  console.log(chalk.yellow('  history [--limit <number>]'));
  console.log('    查看校验历史');
  console.log('    --limit: 显示最近的记录数 (默认 5)');
  console.log('');
  console.log(chalk.yellow('  export <output> [--format <format>]'));
  console.log('    导出最近一次的校验结果');
  console.log('    --format: 导出格式 (json, csv)，默认 json');
  console.log('');
  console.log(chalk.bold('示例:'));
  console.log('');
  console.log(chalk.gray('  # 初始化'));
  console.log('  club-reimburse init');
  console.log('');
  console.log(chalk.gray('  # 导入预算数据'));
  console.log('  club-reimburse import budgets.json -t budget');
  console.log('');
  console.log(chalk.gray('  # 执行校验'));
  console.log('  club-reimburse check');
  console.log('');
  console.log(chalk.gray('  # 导出结果'));
  console.log('  club-reimburse export result.csv -f csv');
  console.log('');
}

program.parse(process.argv);
