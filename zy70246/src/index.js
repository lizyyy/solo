#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const { importToilets, importComplaints } = require('./commands/import');
const { queryToilets, queryComplaints, queryAnomalies } = require('./commands/query');
const { generateRoute, rerunCheck, showHistory, clearData } = require('./commands/route');
const { generateReport } = require('./commands/report');

const program = new Command();

program
  .name('toilet-cli')
  .description('城市公厕保洁路线 CLI 工具 - 按人流、投诉和补给库存动态调整路线')
  .version('1.0.0', '-v, --version', '显示版本号');

program
  .command('import:toilets')
  .description('导入公厕点位数据')
  .argument('<file>', '公厕数据 JSON 文件路径')
  .option('-s, --source <name>', '数据来源名称')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((file, options) => {
    importToilets(file, options);
  });

program
  .command('import:complaints')
  .description('导入投诉数据')
  .argument('<file>', '投诉数据 JSON 文件路径')
  .option('-s, --source <name>', '数据来源名称')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((file, options) => {
    importComplaints(file, options);
  });

program
  .command('query:toilets')
  .alias('q:t')
  .description('查询公厕点位数据')
  .option('-i, --id <id>', '按公厕编号查询详情')
  .option('-D, --district <name>', '按行政区筛选')
  .option('-p, --priority <level>', '按优先级筛选 (critical/high/normal)')
  .option('--only-invalid', '只显示无效数据')
  .option('--only-warnings', '只显示有预警的数据')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    queryToilets(options);
  });

program
  .command('query:complaints')
  .alias('q:c')
  .description('查询投诉数据')
  .option('-t, --toilet-id <id>', '按公厕编号筛选')
  .option('-s, --status <status>', '按状态筛选 (待处理/处理中/已解决/已关闭)')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    queryComplaints(options);
  });

program
  .command('query:anomalies')
  .alias('q:a')
  .description('查询异常数据（重复数据、缺字段、人工改错等）')
  .option('-t, --type <type>', '异常类型筛选 (all/invalid/duplicate/warning)', 'all')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    queryAnomalies(options);
  });

program
  .command('route')
  .description('生成保洁路线（按优先级排序）')
  .option('--by-district', '按行政区分组显示')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    generateRoute(options);
  });

program
  .command('rerun')
  .description('重跑数据校验检查（同步投诉数、重新校验格式）')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    rerunCheck(options);
  });

program
  .command('history')
  .description('查看数据导入历史记录')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    showHistory(options);
  });

program
  .command('report')
  .description('生成业务负责人报告（JSON + HTML格式）')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    generateReport(options);
  });

program
  .command('clear')
  .description('清空所有数据（谨慎使用）')
  .option('-d, --data-dir <dir>', '数据存储目录', './data')
  .action((options) => {
    clearData(options);
  });

program
  .command('help:examples')
  .description('显示常用命令示例')
  .action(() => {
    console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
    console.log(chalk.bold.cyan('│            常用命令使用示例                  │'));
    console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));
    
    console.log(chalk.bold('📥 数据导入:'));
    console.log(chalk.white('  toilet-cli import:toilets samples/toilets-valid.json'));
    console.log(chalk.white('  toilet-cli import:complaints samples/complaints-valid.json'));
    console.log(chalk.gray('  -s, --source: 指定数据来源名称\n'));
    
    console.log(chalk.bold('🔍 数据查询:'));
    console.log(chalk.white('  toilet-cli query:toilets                    # 查询所有公厕'));
    console.log(chalk.white('  toilet-cli query:toilets -i T000001        # 查询单个公厕详情'));
    console.log(chalk.white('  toilet-cli query:toilets -p critical       # 只看紧急优先级'));
    console.log(chalk.white('  toilet-cli query:complaints -s 待处理      # 只看待处理投诉\n'));
    
    console.log(chalk.bold('⚠️  异常查询:'));
    console.log(chalk.white('  toilet-cli query:anomalies                  # 查询所有异常'));
    console.log(chalk.white('  toilet-cli query:anomalies -t invalid      # 只看无效数据'));
    console.log(chalk.white('  toilet-cli query:anomalies -t duplicate    # 只看重复数据\n'));
    
    console.log(chalk.bold('🛣️  路线规划:'));
    console.log(chalk.white('  toilet-cli route                           # 生成保洁路线'));
    console.log(chalk.white('  toilet-cli route --by-district             # 按行政区分组\n'));
    
    console.log(chalk.bold('🔄 数据维护:'));
    console.log(chalk.white('  toilet-cli rerun                           # 重跑校验检查'));
    console.log(chalk.white('  toilet-cli history                         # 查看导入历史'));
    console.log(chalk.white('  toilet-cli report                          # 生成业务报告\n'));
    
    console.log(chalk.bold('💡 快速验收流程:'));
    console.log(chalk.gray('  1. 导入正常数据: toilet-cli import:toilets samples/toilets-valid.json'));
    console.log(chalk.gray('  2. 导入异常数据: toilet-cli import:toilets samples/toilets-anomalies.json'));
    console.log(chalk.gray('  3. 查看异常:   toilet-cli query:anomalies'));
    console.log(chalk.gray('  4. 生成路线:   toilet-cli route'));
    console.log(chalk.gray('  5. 生成报告:   toilet-cli report\n'));
  });

program.on('command:*', (operands) => {
  console.error(chalk.red(`错误: 未知命令 "${operands[0]}"`));
  console.log(chalk.gray('使用 "toilet-cli --help" 查看可用命令'));
  process.exit(1);
});

if (process.argv.length <= 2) {
  program.help();
}

program.parse(process.argv);
