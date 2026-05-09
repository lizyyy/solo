#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');

const importRequirements = require('../src/commands/importRequirements');
const mapTestCases = require('../src/commands/mapTestCases');
const indexCode = require('../src/commands/indexCode');
const analyzeGaps = require('../src/commands/analyzeGaps');
const generateReport = require('../src/commands/generateReport');
const listFailures = require('../src/commands/listFailures');

const program = new Command();

program
  .name('tcm')
  .description('测试覆盖证据映射 CLI 工具')
  .version('1.0.0');

program
  .command('import:requirements')
  .description('导入需求数据')
  .argument('<file>', '需求数据文件路径 (JSON)')
  .option('-o, --overwrite', '覆盖已存在的需求')
  .option('--no-skip-duplicates', '不跳过重复项，更新已存在的需求')
  .option('-v, --verbose', '显示详细信息')
  .action(async (file, options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  需求导入'));
    console.log(chalk.cyan('========================================\n'));
    await importRequirements(path.resolve(file), options);
  });

program
  .command('map:testcases')
  .description('映射测试用例到需求')
  .argument('<file>', '测试用例数据文件路径 (JSON)')
  .option('-o, --overwrite', '覆盖已存在的测试用例')
  .option('--no-skip-duplicates', '不跳过重复项，更新已存在的测试用例')
  .option('-v, --verbose', '显示详细信息')
  .action(async (file, options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  测试用例映射'));
    console.log(chalk.cyan('========================================\n'));
    await mapTestCases(path.resolve(file), options);
  });

program
  .command('index:code')
  .description('索引源码路径并关联测试用例')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  源码路径索引'));
    console.log(chalk.cyan('========================================\n'));
    await indexCode(options);
  });

program
  .command('analyze:gaps')
  .description('分析覆盖缺口')
  .option('-l, --limit <number>', '限制显示的缺口数量', '10')
  .action(async (options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  覆盖缺口分析'));
    console.log(chalk.cyan('========================================\n'));
    await analyzeGaps(options);
  });

program
  .command('report:generate')
  .description('生成证据报告')
  .option('-f, --format <format>', '报告格式: json, html, markdown, all', 'json')
  .action(async (options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  证据报告生成'));
    console.log(chalk.cyan('========================================\n'));
    await generateReport(options);
  });

program
  .command('failures:list')
  .description('查看失败项记录')
  .option('-t, --type <type>', '按失败类型过滤')
  .option('-r, --related-id <id>', '按相关ID过滤')
  .option('-l, --limit <number>', '限制显示的数量')
  .action(async (options) => {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  失败项列表'));
    console.log(chalk.cyan('========================================\n'));
    await listFailures(options);
  });

program
  .command('run:all')
  .description('运行完整流程: 导入需求 -> 映射用例 -> 索引代码 -> 分析缺口 -> 生成报告')
  .argument('<requirementsFile>', '需求数据文件路径')
  .argument('<testCasesFile>', '测试用例数据文件路径')
  .option('-f, --format <format>', '报告格式: json, html, markdown, all', 'all')
  .option('-v, --verbose', '显示详细信息')
  .action(async (requirementsFile, testCasesFile, options) => {
    console.log(chalk.bold.green('\n========================================'));
    console.log(chalk.bold.green('  测试覆盖证据映射 - 完整流程'));
    console.log(chalk.bold.green('========================================\n'));

    try {
      console.log(chalk.bold.yellow('\n[1/5] 导入需求数据...'));
      await importRequirements(path.resolve(requirementsFile), { verbose: options.verbose });

      console.log(chalk.bold.yellow('\n[2/5] 映射测试用例...'));
      await mapTestCases(path.resolve(testCasesFile), { verbose: options.verbose });

      console.log(chalk.bold.yellow('\n[3/5] 索引源码路径...'));
      try {
        await indexCode({ verbose: options.verbose });
      } catch (error) {
        console.log(chalk.yellow('  警告: 源码索引失败，继续执行后续步骤'));
      }

      console.log(chalk.bold.yellow('\n[4/5] 分析覆盖缺口...'));
      await analyzeGaps({ limit: '10' });

      console.log(chalk.bold.yellow('\n[5/5] 生成证据报告...'));
      await generateReport({ format: options.format });

      console.log(chalk.bold.green('\n========================================'));
      console.log(chalk.bold.green('  完整流程执行完成！'));
      console.log(chalk.bold.green('========================================\n'));
    } catch (error) {
      console.log(chalk.bold.red('\n========================================'));
      console.log(chalk.bold.red('  流程执行中断'));
      console.log(chalk.bold.red('========================================\n'));
      console.log(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program.parse(process.argv);
