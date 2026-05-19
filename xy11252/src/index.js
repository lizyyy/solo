#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { importCommand } = require('./commands/import');
const { reviewCommand } = require('./commands/review');
const { queryCommand, detailCommand } = require('./commands/query');
const { exportCommand, reportCommand } = require('./commands/export');
const { showStatistics } = require('./commands/query');

const program = new Command();

program
  .name('reconcile')
  .description('生鲜缺货对账CLI工具 - 处理退款、换货、补券对账')
  .version('1.0.0');

program
  .command('stats')
  .description('显示统计摘要')
  .action(() => {
    showStatistics();
  });

program
  .command('import <file>')
  .description('导入订单数据 (支持 .json 和 .csv)')
  .action(importCommand);

program
  .command('review <orderNo>')
  .description('复核订单')
  .option('--status <status>', '设置订单状态: pending|reviewed|completed|exception')
  .option('--exception-type <type>', '设置异常类型: amount_mismatch|data_incomplete|customer_complaint|other')
  .option('--action <type>', '执行操作: refund|exchange|coupon')
  .option('--amount <number>', '退款/补券金额')
  .option('--product <name>', '换货商品名称')
  .option('--exchange-amount <number>', '换货金额')
  .option('--coupon <code>', '优惠券编码')
  .option('--notes <text>', '备注信息')
  .action(reviewCommand);

program
  .command('query')
  .description('查询订单列表')
  .option('--handler <name>', '按负责人筛选')
  .option('--status <status>', '按状态筛选')
  .option('--exception-type <type>', '按异常类型筛选')
  .option('--start-date <date>', '开始日期 (YYYY-MM-DD)')
  .option('--end-date <date>', '结束日期 (YYYY-MM-DD)')
  .option('--stats', '仅显示统计摘要')
  .option('--detail', '显示单条详情')
  .action(queryCommand);

program
  .command('detail <orderNo>')
  .description('查看订单详情')
  .action(detailCommand);

program
  .command('export <output>')
  .description('导出订单数据')
  .option('--handler <name>', '按负责人筛选导出')
  .option('--status <status>', '按状态筛选导出')
  .option('--exception-type <type>', '按异常类型筛选导出')
  .option('--start-date <date>', '开始日期筛选')
  .option('--end-date <date>', '结束日期筛选')
  .option('--with-actions', '包含操作记录')
  .action(exportCommand);

program
  .command('report [output]')
  .description('生成完整对账报告')
  .option('--handler <name>', '按负责人筛选')
  .option('--status <status>', '按状态筛选')
  .option('--exception-type <type>', '按异常类型筛选')
  .option('--start-date <date>', '开始日期')
  .option('--end-date <date>', '结束日期')
  .action(reportCommand);

program.addHelpText('after', `

${chalk.bold('使用示例:')}

  ${chalk.gray('# 显示统计')}
  reconcile stats

  ${chalk.gray('# 导入数据')}
  reconcile import orders.csv
  reconcile import orders.json

  ${chalk.gray('# 查询订单')}
  reconcile query
  reconcile query --handler 张三
  reconcile query --status pending
  reconcile query --status exception --exception-type amount_mismatch

  ${chalk.gray('# 复核订单')}
  reconcile review ORD001 --action refund --amount 99.00
  reconcile review ORD002 --action exchange --product 替换商品
  reconcile review ORD003 --action coupon --coupon COUPON001 --amount 50.00
  reconcile review ORD004 --status exception --exception-type customer_complaint

  ${chalk.gray('# 查看详情')}
  reconcile detail ORD001

  ${chalk.gray('# 导出数据')}
  reconcile export output.csv
  reconcile export output.json --with-actions
  reconcile export pending.csv --status pending

  ${chalk.gray('# 生成报告')}
  reconcile report
  reconcile report my-report.json

${chalk.bold('状态说明:')}
  pending    - 待处理
  reviewed   - 已复核
  completed  - 已完成
  exception  - 异常

${chalk.bold('操作类型:')}
  refund     - 退款
  exchange   - 换货
  coupon     - 补券

${chalk.bold('异常类型:')}
  amount_mismatch     - 金额不符
  data_incomplete     - 数据不全
  customer_complaint  - 客户投诉
  other               - 其他
`);

program.parse();
