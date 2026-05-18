#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const DataReader = require('./dataReader');
const RevokeChecker = require('./revokeChecker');
const ReportGenerator = require('./reportGenerator');

const program = new Command();

program
  .name('revoke-checker')
  .description('人群包发布记录撤销渠道核对 CLI')
  .version('1.0.0');

program
  .option('--data-dir <dir>', '数据文件目录，包含人群包.csv、渠道投放.csv、撤销记录.csv', './data')
  .option('--output-dir <dir>', '报告输出目录', './output')
  .option('--no-console', '不在控制台输出报告')
  .option('--no-file', '不生成文件报告')
  .action(async (options) => {
    try {
      const dataDir = path.resolve(process.cwd(), options.dataDir);
      const outputDir = path.resolve(process.cwd(), options.outputDir);

      console.log(chalk.cyan('正在读取数据文件...'));
      console.log(chalk.gray(`数据目录: ${dataDir}`));

      const reader = new DataReader(dataDir);
      const data = await reader.readAll();

      console.log(chalk.green('✓ 数据读取完成'));
      console.log(chalk.gray(`  人群包: ${data.crowdPackages.data.length} 条`));
      console.log(chalk.gray(`  渠道投放: ${data.channelDelivery.data.length} 条`));
      console.log(chalk.gray(`  撤销记录: ${data.revokeRecords.data.length} 条`));

      console.log('');
      console.log(chalk.cyan('正在进行撤销渠道核对...'));

      const checker = new RevokeChecker(data);
      const result = checker.check();

      console.log(chalk.green('✓ 核对完成'));
      console.log('');

      const generator = new ReportGenerator(result, outputDir);

      if (options.console) {
        generator.generateConsoleReport();
      }

      if (options.file) {
        const filePath = await generator.generateFileReport();
        console.log(chalk.green(`✓ 报告已保存至: ${filePath}`));
        console.log('');
      }

      if (result.failed > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('✗ 运行出错:'));
      console.error(chalk.red(`  ${error.message}`));
      console.error('');
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
