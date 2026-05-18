#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const LeatherCareProcessor = require('./processor');

const program = new Command();

const DEFAULT_CONFIG = {
  input: './data/皮具护理进度原始数据.json',
  output: './output',
  rules: require('../config/rules')
};

function loadConfig(customConfigPath) {
  if (customConfigPath) {
    const fullPath = path.resolve(customConfigPath);
    try {
      return require(fullPath);
    } catch (e) {
      console.log(chalk.yellow(`⚠️  自定义配置文件加载失败，使用默认配置: ${e.message}`));
    }
  }
  return DEFAULT_CONFIG;
}

program
  .name('leather-care')
  .description('皮具护理店皮具护理进度管理CLI工具')
  .version('1.0.0');

program
  .command('preview')
  .description('预览计划动作，不写入文件')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-i, --input <path>', '指定输入数据文件路径')
  .option('--sample', '使用内置样例数据预览')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      
      let inputPath = options.input || config.input;
      
      if (options.sample) {
        inputPath = './data/样例数据.json';
      }

      const processor = new LeatherCareProcessor(config);
      const data = processor.loadData(inputPath);
      
      console.log(chalk.cyan(`📂 加载数据文件: ${inputPath}`));
      console.log(chalk.cyan(`📋 共 ${data.length} 条护理记录\n`));

      processor.process(data);
      const results = processor.writeResults(config.output, true);
      processor.printPreview(results);

    } catch (error) {
      console.error(chalk.red('❌ 预览失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('正式模式，处理数据并写入结果文件')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-i, --input <path>', '指定输入数据文件路径')
  .option('-o, --output <path>', '指定输出目录')
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      
      const inputPath = options.input || config.input;
      const outputDir = options.output || config.output;

      const processor = new LeatherCareProcessor(config);
      const data = processor.loadData(inputPath);
      
      console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
      console.log(chalk.cyan.bold('           皮具护理进度 - 正式模式'));
      console.log(chalk.cyan.bold('='.repeat(60)) + '\n');

      console.log(chalk.cyan(`📂 加载数据文件: ${inputPath}`));
      console.log(chalk.cyan(`📋 共 ${data.length} 条护理记录\n`));

      processor.process(data);
      const results = processor.writeResults(outputDir, false);

      console.log(chalk.green.bold('✅ 处理完成！文件已写入:\n'));
      
      Object.entries(results).forEach(([key, result]) => {
        if (key === 'summary') {
          console.log(chalk.yellow.bold(`  📊 ${path.basename(result.filePath)}`));
        } else {
          console.log(chalk.green(`  📄 ${path.basename(result.filePath)} (${result.count}条)`));
        }
      });

      console.log(chalk.cyan.bold('\n' + '='.repeat(60)));
      console.log(chalk.cyan(`  输出目录: ${path.resolve(outputDir)}`));
      console.log(chalk.cyan.bold('='.repeat(60)) + '\n');

    } catch (error) {
      console.error(chalk.red('❌ 处理失败:'), error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
