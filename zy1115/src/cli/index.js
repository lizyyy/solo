#!/usr/bin/env node

const { program } = require('commander');
const packageJson = require('../../package.json');
const scanCommand = require('./commands/scan');
const checkCommand = require('./commands/check');
const compareCommand = require('./commands/compare');
const exportCommand = require('./commands/export');

program
  .name('schema-drift')
  .description('检查前端 mock、测试 fixture、抓包响应和 OpenAPI 文档之间的 schema 漂移')
  .version(packageJson.version);

program.addCommand(scanCommand);
program.addCommand(checkCommand);
program.addCommand(compareCommand);
program.addCommand(exportCommand);

program.parse(process.argv);
