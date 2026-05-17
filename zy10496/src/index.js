#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const { validateInputs } = require('./utils/validator');
const { parseLogs } = require('./parsers/log-parser');
const { BotFilterEngine } = require('./engine/filter-engine');
const { generateReports } = require('./reporters/report-generator');
const { printSummary } = require('./reporters/console-summary');
const config = require('./config/default-rules');

const program = new Command();

program
  .name('bot-filter')
  .description('访问日志爬虫过滤CLI工具 - 识别并过滤访问日志中的机器人流量')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', '输入日志文件或目录路径')
  .option('-o, --output <path>', '输出结果目录', './bot-filter-output')
  .option('-c, --config <path>', '自定义规则配置文件路径')
  .option('-f, --format <format>', '日志格式: nginx, apache, common, combined', 'nginx')
  .option('--sample-count <number>', '每个分类保留的样本数量', '50')
  .option('--no-report', '不生成HTML报告')
  .option('--no-json', '不输出JSON结果')
  .option('--verbose', '显示详细处理信息');

program.parse();

const options = program.opts();

async function main() {
  console.log(chalk.bold.blue('\n🤖 访问日志爬虫过滤工具启动...\n'));

  try {
    const validation = validateInputs(options);
    if (!validation.valid) {
      console.error(chalk.red('❌ 输入校验失败:'));
      validation.errors.forEach(err => console.error(chalk.red(`   - ${err}`)));
      process.exit(1);
    }

    const inputPath = path.resolve(options.input);
    const outputPath = path.resolve(options.output);

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    let filterConfig = { ...config };
    if (options.config) {
      const customConfigPath = path.resolve(options.config);
      if (fs.existsSync(customConfigPath)) {
        const customConfig = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'));
        if (customConfig.rules) {
          filterConfig.rules = { ...filterConfig.rules, ...customConfig.rules };
        }
        if (customConfig.scoring) {
          filterConfig.scoring = { ...filterConfig.scoring, ...customConfig.scoring };
        }
        console.log(chalk.green(`✅ 已加载自定义规则配置: ${customConfigPath}`));
      } else {
        console.warn(chalk.yellow(`⚠️  自定义配置文件不存在，使用默认规则`));
      }
    }

    console.log(chalk.blue(`📂 输入路径: ${inputPath}`));
    console.log(chalk.blue(`📤 输出目录: ${outputPath}`));
    console.log(chalk.blue(`📝 日志格式: ${options.format}`));
    console.log('');

    const parseResult = await parseLogs(inputPath, options);

    if (options.verbose) {
      console.log(chalk.gray(`   解析完成: ${parseResult.totalLines} 行, ${parseResult.parsedCount} 条有效记录`));
    }

    const filterEngine = new BotFilterEngine(filterConfig, options);
    const filterResult = filterEngine.analyze(parseResult.records);

    printSummary(filterResult, parseResult, options);

    await generateReports(filterResult, parseResult, outputPath, options);

    console.log(chalk.bold.green('\n✅ 处理完成!'));
    console.log(chalk.blue(`📊 报告目录: ${outputPath}`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('\n❌ 处理失败:'));
    console.error(chalk.red(`   ${error.message}`));
    if (options.verbose) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

main();
