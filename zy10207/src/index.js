#!/usr/bin/env node

const yargs = require('yargs');
const chalk = require('chalk');

yargs
  .commandDir('./commands')
  .demandCommand(1, chalk.red('请指定要执行的命令'))
  .help()
  .alias('help', 'h')
  .version('1.0.0')
  .alias('version', 'v')
  .epilogue('水站桶装水押金对账 CLI 工具 - 帮助您管理客户押金、空桶回收和对账流程')
  .argv;
