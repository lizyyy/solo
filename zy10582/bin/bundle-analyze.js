#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { runBundleAnalyzer } = require('../src/index');

const program = new Command();

program
  .name('bundle-analyze')
  .description('前端包体来源分析CLI工具')
  .version('1.0.0')
  .option('-i, --input <dir>', '输入目录（构建产物所在目录）', process.cwd())
  .option('-o, --output <dir>', '输出目录（报告保存位置）', path.join(process.cwd(), 'bundle-report'))
  .option('--no-gzip', '不计算Gzip大小')
  .option('--no-history', '不保存历史记录')
  .option('--history-limit <number>', '历史记录保留数量', '10')
  .option('--pattern <patterns...>', '自定义文件匹配模式', ['**/dist/**/*.js', '**/build/**/*.js', '**/*.js.map'])
  .option('--exclude <patterns...>', '排除文件模式')
  .action(async (options) => {
    try {
      const result = await runBundleAnalyzer({
        inputDir: options.input,
        outputDir: options.output,
        gzip: options.gzip,
        keepHistory: options.history,
        historyLimit: parseInt(options.historyLimit, 10),
        buildPatterns: options.pattern,
        excludePatterns: options.exclude
      });

      if (result.success) {
        process.exit(0);
      }
    } catch (error) {
      console.error('命令执行失败:', error.message);
      process.exit(1);
    }
  });

program.addHelpText('after', `

示例:
  $ bundle-analyze                    # 分析当前目录
  $ bundle-analyze -i ./dist          # 分析 ./dist 目录
  $ bundle-analyze -o ./my-report     # 输出到 ./my-report 目录
  $ bundle-analyze --no-history       # 不保存历史记录
  $ bundle-analyze --pattern "**/*.js" --exclude "**/vendor.js"
`);

program.parseAsync(process.argv);
