#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');

const initCommand = require('../src/commands/init');
const analyzeCommand = require('../src/commands/analyze');
const compareCommand = require('../src/commands/compare');
const exportCommand = require('../src/commands/export');

program
  .name('msa')
  .description('微服务架构分析工具')
  .version('1.0.0');

program
  .command('init')
  .description('初始化项目目录和配置')
  .option('-d, --dir <path>', '目标目录，默认为当前目录', '.')
  .option('--seed', '生成样例数据')
  .action(async (options) => {
    try {
      await initCommand.run(options);
    } catch (error) {
      console.error('❌ 初始化失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('分析架构数据并生成报告')
  .option('-c, --config <path>', '配置文件路径', 'msa-config.yaml')
  .option('-o, --output <path>', '输出目录', './reports')
  .option('--format <format>', '输出格式：all, markdown, json', 'all')
  .action(async (options) => {
    try {
      await analyzeCommand.run(options);
    } catch (error) {
      console.error('❌ 分析失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('compare')
  .description('比较两次分析结果')
  .argument('<oldReport>', '旧报告文件路径')
  .argument('<newReport>', '新报告文件路径')
  .option('-o, --output <path>', '输出目录', './reports')
  .action(async (oldReport, newReport, options) => {
    try {
      await compareCommand.run(oldReport, newReport, options);
    } catch (error) {
      console.error('❌ 对比失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('导出分析报告')
  .option('-r, --report <id>', '报告ID')
  .option('-o, --output <path>', '输出目录', './reports')
  .option('--format <format>', '导出格式：markdown, json', 'markdown')
  .action(async (options) => {
    try {
      await exportCommand.run(options);
    } catch (error) {
      console.error('❌ 导出失败:', error.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((error) => {
  console.error('❌ 执行失败:', error.message);
  process.exit(1);
});
