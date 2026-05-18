#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { processFile, loadConfig } = require('./processor');
const { generateReport } = require('./reporter');

const program = new Command();

program
  .name('dental-consumables')
  .description('口腔诊所耗材领用汇总CLI工具 - 状态和证据留存')
  .version('1.0.0');

program
  .command('process')
  .description('处理耗材领用汇总文件')
  .argument('[file]', '要处理的CSV文件路径')
  .option('-c, --config <path>', '规则配置文件路径', './config/rules.json')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-v, --verbose', '详细日志模式')
  .option('--sample', '使用样例数据运行')
  .action(async (file, options) => {
    try {
      const targetFile = options.sample 
        ? path.join(__dirname, '../samples/dental-consumables-sample.csv')
        : file;
      
      if (!options.sample && !targetFile) {
        console.error(chalk.red('错误: 请提供文件路径或使用 --sample 选项运行样例数据'));
        process.exit(1);
      }
      
      if (!options.sample && !fs.existsSync(targetFile)) {
        console.error(chalk.red(`错误: 文件不存在 - ${targetFile}`));
        process.exit(1);
      }

      const config = loadConfig(options.config);
      const result = await processFile(targetFile, config, options.verbose);
      
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      generateReport(result, options.output, options.verbose);
      
      console.log(chalk.green('\n✓ 处理完成!'));
      console.log(chalk.cyan(`  输出目录: ${path.resolve(options.output)}`));
      
    } catch (error) {
      console.error(chalk.red('处理失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
