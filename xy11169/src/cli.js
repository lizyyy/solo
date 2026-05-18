#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const PhoneReportProcessor = require('./processor');

const program = new Command();

program
  .name('phone-report')
  .description('二手手机回收店手机检测报告数据清洗工具')
  .version('1.0.0');

program
  .command('clean')
  .description('清洗检测报告数据')
  .argument('<files...>', '要处理的CSV文件路径')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-n, --name <filename>', '输出文件名', 'cleaned_report.csv')
  .action(async (files, options) => {
    console.log(chalk.blue('\n=== 二手手机检测报告数据清洗工具 ===\n'));
    
    const processor = new PhoneReportProcessor({
      outputDir: options.output
    });

    try {
      const absoluteFiles = files.map(f => path.resolve(f));
      
      console.log(chalk.yellow(`开始处理 ${files.length} 个文件...\n`));
      
      await processor.processFiles(absoluteFiles);
      
      const outputPath = await processor.writeOutput(options.name);
      const summaryPath = await processor.writeSummary();
      
      const summary = processor.getSummary();
      
      console.log(chalk.green('✓ 处理完成!\n'));
      console.log(chalk.cyan('--- 处理摘要 ---'));
      console.log(`成功处理记录: ${chalk.bold(summary.totalRecords)} 条`);
      console.log(`错误记录: ${chalk.red.bold(summary.errors)} 条`);
      console.log(`警告记录: ${chalk.yellow.bold(summary.warnings)} 条`);
      console.log(`重复序列号: ${chalk.magenta.bold(summary.duplicateSerials)} 个\n`);
      
      if (outputPath) {
        console.log(chalk.green(`清洗后数据: ${outputPath}`));
      }
      console.log(chalk.yellow(`错误摘要: ${summaryPath}`));
      
      if (processor.warnings.length > 0) {
        console.log(chalk.yellow('\n--- 警告详情 ---'));
        processor.warnings.forEach(w => {
          console.log(chalk.yellow(`  [${w.file}:${w.lineNumber}] ${w.message}`));
        });
      }
      
      if (processor.errors.length > 0) {
        console.log(chalk.red('\n--- 错误详情 ---'));
        processor.errors.forEach(e => {
          console.log(chalk.red(`  [${e.file}:${e.lineNumber}] ${e.message}`));
        });
      }
      
      console.log('\n');
      
    } catch (error) {
      console.error(chalk.red(`\n✗ 处理失败: ${error.message}\n`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('仅验证数据不输出清洗结果')
  .argument('<files...>', '要验证的CSV文件路径')
  .action(async (files) => {
    console.log(chalk.blue('\n=== 二手手机检测报告数据验证工具 ===\n'));
    
    const processor = new PhoneReportProcessor();

    try {
      const absoluteFiles = files.map(f => path.resolve(f));
      
      console.log(chalk.yellow(`开始验证 ${files.length} 个文件...\n`));
      
      await processor.processFiles(absoluteFiles);
      
      const summary = processor.getSummary();
      
      console.log(chalk.green('✓ 验证完成!\n'));
      console.log(chalk.cyan('--- 验证摘要 ---'));
      console.log(`有效记录: ${chalk.bold(summary.totalRecords)} 条`);
      console.log(`错误记录: ${chalk.red.bold(summary.errors)} 条`);
      console.log(`警告记录: ${chalk.yellow.bold(summary.warnings)} 条`);
      console.log(`重复序列号: ${chalk.magenta.bold(summary.duplicateSerials)} 个\n`);
      
      if (processor.warnings.length > 0) {
        console.log(chalk.yellow('--- 警告详情 ---'));
        processor.warnings.forEach(w => {
          console.log(chalk.yellow(`  [${w.file}:${w.lineNumber}] ${w.message}`));
        });
        console.log('');
      }
      
      if (processor.errors.length > 0) {
        console.log(chalk.red('--- 错误详情 ---'));
        processor.errors.forEach(e => {
          console.log(chalk.red(`  [${e.file}:${e.lineNumber}] ${e.message}`));
        });
        console.log('');
      }
      
    } catch (error) {
      console.error(chalk.red(`\n✗ 验证失败: ${error.message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);
