#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { analyzeHar } = require('./analyzer');
const { generateConsoleSummary } = require('./output/console');
const { generateCsvOutput } = require('./output/csv');
const { generateHtmlReport } = require('./output/html');

const program = new Command();

program
  .name('har-latency')
  .description('HAR 文件延迟分桶分析工具')
  .version('1.0.0')
  .argument('<har-file>', 'HAR 文件路径')
  .option('-o, --output <directory>', '输出目录', './har-report')
  .option('-b, --buckets <numbers>', '延迟分桶阈值（毫秒），逗号分隔', '100,500,1000,2000,5000')
  .option('-t, --top <number>', '各分类下显示前 N 个样本', '5')
  .option('--no-csv', '不生成 CSV 输出')
  .option('--no-html', '不生成 HTML 报告')
  .option('--no-summary', '不显示终端摘要')
  .action(async (harFile, options) => {
    try {
      if (!fs.existsSync(harFile)) {
        console.error(chalk.red(`错误: 文件不存在 - ${harFile}`));
        process.exit(1);
      }

      const stats = fs.statSync(harFile);
      if (!stats.isFile()) {
        console.error(chalk.red(`错误: 路径不是文件 - ${harFile}`));
        process.exit(1);
      }

      const buckets = options.buckets.split(',').map(b => {
        const num = parseInt(b.trim(), 10);
        if (isNaN(num) || num < 0) {
          console.error(chalk.red(`错误: 无效的分桶值 - ${b}`));
          process.exit(1);
        }
        return num;
      }).sort((a, b) => a - b);

      const topN = parseInt(options.top, 10);
      if (isNaN(topN) || topN < 1) {
        console.error(chalk.red(`错误: 无效的 top 值 - ${options.top}`));
        process.exit(1);
      }

      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      console.log(chalk.blue(`正在分析 HAR 文件: ${harFile}`));
      console.log(chalk.gray(`输出目录: ${outputDir}`));
      console.log(chalk.gray(`延迟分桶: ${buckets.map(b => b + 'ms').join(', ')}`));
      console.log('');

      const result = await analyzeHar(harFile, {
        buckets,
        topN,
        outputDir,
        harFilePath: harFile
      });

      if (options.summary) {
        generateConsoleSummary(result);
      }

      if (options.csv) {
        await generateCsvOutput(result, outputDir);
      }

      if (options.html) {
        await generateHtmlReport(result, outputDir);
      }

      console.log('');
      console.log(chalk.green(`分析完成! 输出文件已保存到: ${outputDir}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow(`注意: 发现 ${result.errors.length} 条异常记录，已保留在报告中`));
      }

      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      if (process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });

program.parse();
