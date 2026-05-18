#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { preview, audit, generateReport } = require('./index');

yargs(hideBin(process.argv))
  .command(
    'preview',
    '预览输入数据，不执行实际核对',
    (yargs) => {
      return yargs
        .option('input', {
          alias: 'i',
          type: 'string',
          description: '输入CSV文件路径',
          demandOption: true
        });
    },
    async (argv) => {
      await preview(argv.input);
    }
  )
  .command(
    'audit',
    '执行舞蹈排练室计费核对',
    (yargs) => {
      return yargs
        .option('input', {
          alias: 'i',
          type: 'string',
          description: '输入CSV文件路径',
          demandOption: true
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          description: '输出目录路径',
          demandOption: true
        });
    },
    async (argv) => {
      await audit(argv.input, argv.output);
    }
  )
  .command(
    'report',
    '生成并查看异常摘要报告',
    (yargs) => {
      return yargs
        .option('output', {
          alias: 'o',
          type: 'string',
          description: '输出目录路径',
          demandOption: true
        });
    },
    async (argv) => {
      await generateReport(argv.output);
    }
  )
  .demandCommand(1, '请指定要执行的命令')
  .help()
  .argv;
