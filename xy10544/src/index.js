#!/usr/bin/env node

const { program } = require('commander');
const initCommand = require('./commands/init');
const importCommand = require('./commands/import');
const checkCommand = require('./commands/check');
const detailCommand = require('./commands/detail');
const reportCommand = require('./commands/report');
const rectifyCommand = require('./commands/rectify');
const reviewCommand = require('./commands/review');
const closeCommand = require('./commands/close');
const fineCommand = require('./commands/fine');
const amendCommand = require('./commands/amend');
const historyCommand = require('./commands/history');

program
  .name('hazard')
  .description('施工隐患闭环管理 CLI 工具')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(importCommand);
program.addCommand(checkCommand);
program.addCommand(detailCommand);
program.addCommand(reportCommand);
program.addCommand(rectifyCommand);
program.addCommand(reviewCommand);
program.addCommand(closeCommand);
program.addCommand(fineCommand);
program.addCommand(amendCommand);
program.addCommand(historyCommand);

program.parse(process.argv);
