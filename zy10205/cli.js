#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const initCmd = require('./src/commands/init');
const importCmd = require('./src/commands/import');
const validateCmd = require('./src/commands/validate');
const confirmCmd = require('./src/commands/confirm');
const historyCmd = require('./src/commands/history');
const exportCmd = require('./src/commands/export');
const reports = require('./src/output/reports');

const program = new Command();

program
  .name('flower-shop')
  .description('花店节日预订单配货 CLI 工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化工作区，加载默认配置')
  .option('-f, --force', '强制重新初始化')
  .action((options) => {
    initCmd.init(options);
  });

program
  .command('import <type> <file>')
  .description('导入数据')
  .addHelpText('after', `
类型说明:
  orders       导入预订单
  inventory    导入库存
  specs        导入花束规格
  replacements 导入可替换花材
  slots        导入配送时段
  cards        导入卡片要求`)
  .action((type, file) => {
    importCmd.handleImport(type, file);
  });

program
  .command('validate [orderId]')
  .description('校验订单')
  .option('-r, --report <type>', '报告类型: before|after|out|all (默认: all)')
  .action((orderId, options) => {
    if (orderId) {
      validateCmd.validateOrder(orderId);
    } else {
      validateCmd.validateAll(options);
    }
  });

const confirmProgram = program
  .command('confirm')
  .description('确认操作');

confirmProgram
  .command('replacement <orderId>')
  .description('确认单个订单的花材替换')
  .option('-b, --by <name>', '确认人姓名 (默认: 系统)')
  .action((orderId, options) => {
    confirmCmd.confirmReplacement(orderId, options);
  });

confirmProgram
  .command('price <orderId>')
  .description('确认订单价格同步')
  .option('-n, --new-price <price>', '新价格 (默认: 自动计算)')
  .option('-b, --by <name>', '确认人姓名 (默认: 系统)')
  .action((orderId, options) => {
    confirmCmd.confirmPrice(orderId, options.newPrice, options);
  });

confirmProgram
  .command('all')
  .description('批量确认所有订单的花材替换')
  .option('-b, --by <name>', '确认人姓名 (默认: 系统)')
  .action((options) => {
    confirmCmd.confirmAll(options);
  });

program
  .command('history')
  .description('查看操作历史')
  .option('-l, --limit <n>', '显示最近 n 条记录 (默认: 20)')
  .option('-a, --action <type>', '按操作类型过滤')
  .action((options) => {
    historyCmd.showHistory(options);
  });

program
  .command('confirmations')
  .description('查看确认记录')
  .option('-o, --order <orderId>', '指定订单号')
  .action((options) => {
    historyCmd.showConfirmations(options.order);
  });

program
  .command('export <type> <output>')
  .description('导出数据')
  .option('-r, --report <type>', '报告类型: before|after|out|all (仅在 type=report 时有效)')
  .addHelpText('after', `
类型说明:
  orders        导出订单
  inventory     导出库存
  picking-list  导出分批拣花单
  report        导出校验报告`)
  .action((type, output, options) => {
    exportCmd.handleExport(type, output, options);
  });

program
  .command('report <type>')
  .description('在终端显示报告')
  .addHelpText('after', `
类型说明:
  before        配货前检查报告
  after         替换后确认报告
  out           缺货待确认报告
  picking       分批拣花单
  all           所有报告 (不含拣花单)`)
  .action((type) => {
    switch (type) {
      case 'before':
        console.log(reports.formatBeforeFulfillment());
        break;
      case 'after':
        console.log(reports.formatAfterReplacement());
        break;
      case 'out':
        console.log(reports.formatOutOfStock());
        break;
      case 'picking':
        console.log(reports.formatPickingList());
        break;
      case 'all':
        console.log(reports.formatBeforeFulfillment());
        console.log('\n');
        console.log(reports.formatAfterReplacement());
        console.log('\n');
        console.log(reports.formatOutOfStock());
        break;
      default:
        console.log(chalk.red(`❌ 未知的报告类型: ${type}`));
        console.log('可用类型: before, after, out, picking, all');
    }
  });

program.parse(process.argv);
