#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const MarkdownChecker = require('../src/index');

program
  .name('md-check')
  .description('Markdown文档断章检查工具 - 检测重复标题、失效内部链接等问题')
  .version('1.0.0');

program
  .command('check <dir>')
  .description('检查指定目录下的Markdown文件')
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('-f, --format <format>', '报告格式: all, terminal, json, human', 'all')
  .option('-v, --verbose', '显示详细信息')
  .action(async (dir, options) => {
    try {
      const checker = new MarkdownChecker({
        verbose: options.verbose,
        outputDir: options.output
      });

      const results = await checker.checkDirectory(dir);
      
      if (options.format === 'all' || options.format === 'terminal') {
        checker.printTerminalSummary(results);
      }
      
      if (options.format === 'all' || options.format === 'json') {
        await checker.exportJSON(results, path.join(options.output, 'check-results.json'));
      }
      
      if (options.format === 'all' || options.format === 'human') {
        await checker.exportHumanReport(results, path.join(options.output, 'check-report.md'));
      }
      
      const hasErrors = results.duplicateTitles.length > 0 || 
                        results.brokenLinks.length > 0 ||
                        results.invalidHeadings.length > 0;
      
      process.exit(hasErrors ? 1 : 0);
      
    } catch (error) {
      console.error(chalk.red('\n❌ 执行出错:'));
      console.error(chalk.yellow(error.message));
      if (options.verbose) {
        console.error('\n' + error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('analyze <file>')
  .description('分析单个Markdown文件的结构')
  .option('-v, --verbose', '显示详细信息')
  .action(async (file, options) => {
    try {
      const checker = new MarkdownChecker({ verbose: options.verbose });
      const analysis = await checker.analyzeFile(file);
      checker.printFileAnalysis(analysis);
    } catch (error) {
      console.error(chalk.red('\n❌ 执行出错:'));
      console.error(chalk.yellow(error.message));
      if (options.verbose) {
        console.error('\n' + error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
