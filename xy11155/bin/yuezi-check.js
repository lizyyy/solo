#!/usr/bin/env node

const { Command } = require('commander');
const { runCheck } = require('../src/index');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('yuezi-check')
  .description('月子餐配送组月子餐配送核对 CLI 工具')
  .version(packageJson.version)
  .argument('<file>', '配送核对数据文件 (CSV格式)')
  .option('-v, --verbose', '显示详细日志')
  .option('-o, --output <file>', '输出结果到指定文件')
  .option('--no-color', '禁用彩色输出')
  .action(async (file, options) => {
    try {
      await runCheck(file, options);
    } catch (error) {
      console.error('\n❌ 执行失败:', error.message);
      process.exit(1);
    }
  });

program.addHelpText('after', `

示例:
  $ yuezi-check ./data/2024-05-19-配送数据.csv
  $ yuezi-check ./data/配送数据.csv -v -o 核对结果.txt
`);

program.parse();
