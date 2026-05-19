#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();
const commands = require('./commands');
const packageJson = require('../package.json');

program
  .name('reagent')
  .description('高校实验室试剂库存与审批管理工具')
  .version(packageJson.version);

program
  .command('init')
  .description('初始化数据存储')
  .action(commands.init);

program
  .command('import <file>')
  .description('从CSV文件导入试剂领用申请')
  .action(commands.importFile);

program
  .command('review')
  .description('复核待审批的申请')
  .option('--approve <id>', '审批通过指定申请')
  .option('--reject <id>', '驳回指定申请')
  .option('--reason <text>', '审批或驳回原因')
  .option('--by <name>', '审批人姓名', '管理员')
  .option('--list', '列出所有待审批申请')
  .action(commands.review);

program
  .command('export <file>')
  .description('导出审批记录到CSV文件')
  .option('--type <type>', '导出类型: all|approved|rejected|pending', 'all')
  .action(commands.exportFile);

program
  .command('status')
  .description('查看当前库存和审批状态')
  .option('--reagent <id>', '查看指定试剂详情')
  .action(commands.status);

program
  .command('retry <batchId>')
  .description('重试失败的批量操作')
  .action(commands.retry);

program
  .command('resubmit <applicationId>')
  .description('重新提交被驳回的申请')
  .action(commands.resubmit);

program
  .command('history')
  .description('查看操作历史')
  .option('--limit <n>', '显示最近N条记录', '10')
  .action(commands.history);

program.parse();
