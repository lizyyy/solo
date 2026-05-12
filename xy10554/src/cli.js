#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const initCommand = require('./commands/init');
const importCommand = require('./commands/import');
const checkCommand = require('./commands/check');
const detailCommand = require('./commands/detail');
const reportCommand = require('./commands/report');

const program = new Command();

program
  .name('content-unpublish')
  .description('内容发布撤稿CLI工具 - 追踪多渠道撤稿状态、缓存清理、引用页面和责任人')
  .version('1.0.0');

program
  .command('init')
  .description('初始化系统并加载样例数据')
  .option('-c, --clear', '清空历史数据')
  .option('-s, --samples', '加载内置样例数据')
  .action((options) => {
    initCommand(options);
  });

program
  .command('import <file>')
  .description('导入内容发布记录 (JSON格式)')
  .action((file, options) => {
    importCommand(file, options);
  });

program
  .command('check [contentId]')
  .description('检查撤稿状态 (不指定ID则检查所有)')
  .option('--summary', '仅显示摘要信息')
  .action((contentId, options) => {
    checkCommand(contentId, options);
  });

program
  .command('detail <contentId>')
  .description('查看内容详细信息')
  .option('-h, --history', '包含操作历史')
  .action((contentId, options) => {
    detailCommand(contentId, options);
  });

program
  .command('report')
  .description('生成撤稿闭环报告')
  .action((options) => {
    reportCommand(options);
  });

program
  .command('list')
  .description('列出所有内容记录')
  .action(() => {
    const Store = require('./utils/store');
    const store = new Store();
    const contents = store.getAllContents();
    
    console.log(chalk.blue('\n=== 内容列表 ===\n'));
    
    if (contents.length === 0) {
      console.log(chalk.yellow('暂无记录'));
      return;
    }
    
    const statusColors = {
      'active': chalk.red,
      'unpublished': chalk.green,
      'partial': chalk.yellow,
      'failed': chalk.bgRed.white,
      'pending': chalk.blue
    };
    
    contents.forEach((content, idx) => {
      const color = statusColors[content.status] || chalk.gray;
      console.log(`[${idx + 1}] ${content.id}`);
      console.log(`    标题: ${content.title}`);
      console.log(`    类型: ${content.type}`);
      console.log(`    状态: ${color(content.status)}`);
      console.log(`    责任人: ${content.owner || chalk.yellow('未指定')}`);
      console.log('');
    });
  });

program.parse(process.argv);
