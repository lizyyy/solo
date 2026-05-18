#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const InspectionValidator = require('./index');

const program = new Command();

program
  .name('inspection-validate')
  .description('维保巡检导出漏检补录校验 CLI - 找出不可信补录记录')
  .version('1.0.0');

program
  .command('validate')
  .description('校验维保巡检补录数据')
  .option('-i, --input <dir>', '输入目录路径', './samples')
  .option('-o, --output <dir>', '输出目录路径', './output')
  .option('-f, --force', '强制重新生成报告（覆盖已有结果）', false)
  .action(async (options) => {
    console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║           维保巡检导出漏检补录校验 CLI v1.0.0                 ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');

    try {
      const inputDir = path.resolve(options.input);
      const outputDir = path.resolve(options.output);

      console.log(chalk.gray(`输入目录: ${inputDir}`));
      console.log(chalk.gray(`输出目录: ${outputDir}`));
      console.log('');

      if (!await fs.pathExists(inputDir)) {
        console.log(chalk.red(`✗ 输入目录不存在: ${inputDir}`));
        process.exit(1);
      }

      const validator = new InspectionValidator({
        inputDir,
        outputDir,
        force: options.force
      });

      const result = await validator.run();
      
      printSummary(result);
      
      if (result.hasErrors) {
        process.exit(1);
      }
    } catch (error) {
      console.log(chalk.red(`✗ 执行失败: ${error.message}`));
      console.error(error.stack);
      process.exit(1);
    }
  });

function printSummary(result) {
  console.log('');
  console.log(chalk.yellow('════════════════════ 校验结果汇总 ════════════════════'));
  console.log('');
  console.log(chalk.white(`处理文件数: ${result.totalFiles}`));
  console.log(chalk.white(`总记录数: ${result.totalRecords}`));
  console.log('');
  console.log(chalk.cyan(`正常记录: ${result.normalCount}`));
  console.log(chalk.magenta(`异常记录: ${result.errorCount}`));
  console.log('');
  
  if (result.errorDetails && result.errorDetails.length > 0) {
    console.log(chalk.red('异常详情:'));
    result.errorDetails.forEach((detail, idx) => {
      console.log(chalk.red(`  ${idx + 1}. [${detail.type}] ${detail.file}:${detail.line} - ${detail.message}`));
    });
    console.log('');
  }
  
  if (result.reportPath) {
    console.log(chalk.green(`✓ 详细报告已生成: ${result.reportPath}`));
  }
  
  console.log('');
  if (result.errorCount > 0) {
    console.log(chalk.red('✗ 发现不可信补录记录，请查看报告'));
  } else {
    console.log(chalk.green('✓ 所有补录记录校验通过'));
  }
  console.log(chalk.yellow('═══════════════════════════════════════════════════════'));
}

program.parse(process.argv);
