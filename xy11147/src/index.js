#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { processUtilitiesData } = require('./processor');
const { ensureOutputDir, printSummary } = require('./utils');

const program = new Command();

program
  .name('utilities-split')
  .description('短租公寓前台短租水电拆分CLI工具')
  .version('1.0.0')
  .requiredOption('--input <file>', '输入CSV文件路径')
  .option('--output <dir>', '输出目录路径', './output')
  .option('--rerun', '重跑模式，标记可复跑记录')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.input)) {
        console.error(chalk.red(`错误：输入文件不存在 - ${options.input}`));
        console.error(chalk.yellow('请检查文件路径后重试'));
        process.exit(1);
      }

      if (!options.input.endsWith('.csv')) {
        console.error(chalk.red('错误：仅支持CSV格式的输入文件'));
        process.exit(1);
      }

      ensureOutputDir(options.output);

      console.log(chalk.blue('='.repeat(60)));
      console.log(chalk.blue('短租公寓前台短租水电拆分工具'));
      console.log(chalk.blue('='.repeat(60)));
      console.log(`输入文件: ${options.input}`);
      console.log(`输出目录: ${options.output}`);
      console.log(`重跑模式: ${options.rerun ? '开启' : '关闭'}`);
      console.log('');

      const result = await processUtilitiesData(options.input, options.output, options.rerun);
      
      printSummary(result);

      console.log('');
      console.log(chalk.green('处理完成！输出文件已保存到指定目录。'));
      console.log(chalk.blue('='.repeat(60)));

    } catch (error) {
      console.error(chalk.red('处理失败！'));
      console.error(chalk.yellow(`错误信息: ${error.message}`));
      console.error('');
      console.error(chalk.gray('可能的原因：'));
      console.error(chalk.gray('1. CSV文件格式不正确'));
      console.error(chalk.gray('2. 文件编码问题（请使用UTF-8编码）'));
      console.error(chalk.gray('3. 缺少必要的列字段'));
      console.error('');
      console.error(chalk.gray('如需帮助，请查看 examples 目录下的样例文件'));
      process.exit(1);
    }
  });

program.parse(process.argv);
