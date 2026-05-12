#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const initCommand = require('../src/commands/init');
const importCommand = require('../src/commands/import');
const checkCommand = require('../src/commands/check');
const detailCommand = require('../src/commands/detail');
const reportCommand = require('../src/commands/report');

const program = new Command();

program
  .name('bounce')
  .description('邮件退信归因 CLI 工具 - 分析营销邮件退信原因')
  .version('1.0.0');

program
  .command('init')
  .description('初始化工作目录，创建配置文件和样例数据')
  .option('-f, --force', '强制覆盖已有配置')
  .action((options) => {
    initCommand(options);
  });

program
  .command('import <type>')
  .description('导入数据（send/bounce/retry/source）')
  .option('-f, --file <path>', '数据文件路径')
  .option('-s, --sample', '使用内置样例数据')
  .action((type, options) => {
    importCommand(type, options);
  });

program
  .command('check')
  .description('执行规则检查，更新状态并显示变化')
  .action(() => {
    checkCommand();
  });

program
  .command('detail <email>')
  .description('查看指定邮箱的详细信息和历史记录')
  .option('--manual <status>', '人工修正状态（valid/invalid/unsubscribed）')
  .option('--operator <name>', '操作者名称（用于人工修正）')
  .option('--reason <text>', '修正原因')
  .action((email, options) => {
    detailCommand(email, options);
  });

program
  .command('report')
  .description('生成归因报告')
  .option('--by-domain', '按域名分组')
  .option('--by-source', '按名单来源分组')
  .option('--by-bounce-code', '按退信码分组')
  .option('--clean', '导出清洗后的名单')
  .option('--retry', '导出重试建议名单')
  .action((options) => {
    reportCommand(options);
  });

program
  .command('list')
  .description('列出当前工作区的各类数据概览')
  .option('--type <type>', '数据类型（all/send/bounce/retry/source）', 'all')
  .action((options) => {
    const { listCommand } = require('../src/commands/list');
    listCommand(options);
  });

program.parse(process.argv);
