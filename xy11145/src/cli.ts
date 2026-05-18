#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ReportProcessor } from './processor';

yargs(hideBin(process.argv))
  .scriptName('medical-report')
  .usage('$0 <cmd> [args]')
  
  .command(
    'process [input] [output]',
    '处理体检中心体检报告分发数据',
    (yargs) => {
      return yargs
        .positional('input', {
          type: 'string',
          describe: '输入目录或文件路径',
          default: './samples'
        })
        .positional('output', {
          type: 'string',
          describe: '输出目录路径',
          default: './output'
        });
    },
    async (argv) => {
      try {
        const processor = new ReportProcessor(argv.output);
        await processor.processDirectory(argv.input);
      } catch (err: any) {
        console.error('❌ 处理失败:', err.message);
        process.exit(1);
      }
    }
  )
  
  .command(
    'reset [output]',
    '重置处理状态，允许重新处理相同文件',
    (yargs) => {
      return yargs
        .positional('output', {
          type: 'string',
          describe: '输出目录路径',
          default: './output'
        });
    },
    (argv) => {
      const processor = new ReportProcessor(argv.output);
      processor.reset();
    }
  )
  
  .command(
    'stats [output]',
    '显示已处理数据的统计信息',
    (yargs) => {
      return yargs
        .positional('output', {
          type: 'string',
          describe: '输出目录路径',
          default: './output'
        });
    },
    (argv) => {
      const processor = new ReportProcessor(argv.output);
      const stats = processor.getStatistics();
      console.log(JSON.stringify(stats, null, 2));
    }
  )
  
  .example('$0 process ./samples ./output', '处理samples目录下的所有报告数据')
  .example('$0 process ./data.csv ./result', '处理单个CSV文件')
  .example('$0 reset ./output', '重置状态，允许重新处理')
  .help('help')
  .alias('help', 'h')
  .version()
  .alias('version', 'v')
  .demandCommand(1, '请指定一个命令')
  .strict()
  .argv;
