#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const GiftCompare = require('./index');
const Logger = require('./utils/logger');
const { loadConfig, validateConfig } = require('./config');

const program = new Command();

program
  .name('gift-compare')
  .description('企业礼品仓礼品稿件比对CLI工具')
  .version('1.0.0')
  .option('--preview', '预览模式，仅显示计划动作不写入文件', false)
  .option('--formal', '正式模式，执行并写入结果文件', false)
  .option('-v, --verbose', '详细日志模式', false)
  .option('-c, --config <path>', '指定配置文件路径', 'config/default.json')
  .option('-o, --output <path>', '指定输出目录', 'output')
  .option('--sample', '运行企业礼品仓业务样例', false)
  .option('--pdf-only', '仅检测PDF字体替换', false)
  .option('--image-only', '仅检测图片压缩', false);

program.parse();

const options = program.opts();
const logger = new Logger(options.verbose);

async function main() {
  logger.info('企业礼品仓礼品稿件比对工具启动');
  
  if (!options.preview && !options.formal && !options.sample) {
    logger.warn('未指定运行模式，默认使用预览模式');
    options.preview = true;
  }

  const config = loadConfig(options.config);
  const configErrors = validateConfig(config);
  
  if (configErrors.length > 0) {
    logger.error('配置文件验证失败:');
    configErrors.forEach(err => logger.error(`  - ${err}`));
    process.exit(1);
  }

  if (options.sample) {
    logger.info('运行企业礼品仓业务样例...');
    options.output = 'sample-output';
    config.sampleMode = true;
  }

  const comparator = new GiftCompare(config, logger, options);
  
  try {
    await comparator.initialize();
    
    logger.info(`运行模式: ${options.preview ? chalk.yellow('预览模式') : chalk.green('正式模式')}`);
    
    const results = await comparator.run();
    
    comparator.printSummary(results);
    
    if (options.formal) {
      await comparator.writeResults(results, options.output);
      logger.success(`结果已写入: ${options.output}`);
    } else if (options.preview) {
      logger.info('预览模式：未写入文件，使用 --formal 参数执行正式写入');
    }
    
    logger.info('比对完成');
  } catch (error) {
    logger.error(`执行失败: ${error.message}`);
    if (options.verbose) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

main();
