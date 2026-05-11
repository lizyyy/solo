#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');

const importCommand = require('./commands/import');
const calculateCommand = require('./commands/calculate');
const reportCommand = require('./commands/report');
const adjustPriceCommand = require('./commands/adjust-price');
const initCommand = require('./commands/init');

console.log(chalk.bold.cyan('🚗 二手车整备费用 CLI 工具'));
console.log(chalk.gray('-----------------------------\n'));

program
  .version('1.0.0')
  .description('二手车整备费用管理工具 - 计算整备成本和毛利');

initCommand(program);
importCommand(program);
calculateCommand(program);
reportCommand(program);
adjustPriceCommand(program);

program.parse(process.argv);
