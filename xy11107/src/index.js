#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const Logger = require('../utils/logger');
const PhotoInspector = require('./photo-inspector');

const program = new Command();

program
  .name('cleaning-inspect')
  .description('民宿管家保洁照片抽检CLI工具')
  .version('1.0.0');

program
  .command('preview')
  .description('预览待处理文件，不执行实际操作')
  .argument('<input-path>', '输入路径（文件夹或压缩包）')
  .option('-v, --verbose', '显示详细日志')
  .action(async (inputPath, options) => {
    const logger = new Logger({ verbose: options.verbose });
    const inspector = new PhotoInspector({ logger, inputPath, preview: true });
    
    logger.info('=== 民宿管家保洁照片抽检 - 预览模式 ===');
    logger.info(`输入路径: ${inputPath}`);
    logger.info('');
    
    await inspector.preview();
  });

program
  .command('run')
  .description('正式执行保洁照片抽检')
  .argument('<input-path>', '输入路径（文件夹或压缩包）')
  .option('-o, --output <dir>', '输出目录，默认: ./output')
  .option('-v, --verbose', '显示详细日志')
  .option('--resume', '断点续跑，跳过已处理文件')
  .action(async (inputPath, options) => {
    const logger = new Logger({ verbose: options.verbose });
    const outputDir = options.output || path.join(process.cwd(), 'output');
    
    const inspector = new PhotoInspector({
      logger,
      inputPath,
      outputDir,
      preview: false,
      resume: options.resume
    });
    
    logger.info('=== 民宿管家保洁照片抽检 - 正式执行 ===');
    logger.info(`输入路径: ${inputPath}`);
    logger.info(`输出目录: ${outputDir}`);
    logger.info('');
    
    await inspector.run();
  });

program
  .command('report')
  .description('查看抽检报告')
  .option('-o, --output <dir>', '输出目录，默认: ./output')
  .action((options) => {
    const outputDir = options.output || path.join(process.cwd(), 'output');
    const reportPath = path.join(outputDir, 'report.json');
    
    if (!fs.existsSync(reportPath)) {
      console.log('未找到抽检报告，请先执行 run 命令');
      return;
    }
    
    const report = fs.readJsonSync(reportPath);
    console.log('');
    console.log('=== 民宿管家保洁照片抽检报告 ===');
    console.log('');
    console.log(`处理时间: ${report.timestamp}`);
    console.log(`总文件数: ${report.totalFiles}`);
    console.log(`正常文件: ${report.normalCount}`);
    console.log(`异常文件: ${report.abnormalCount}`);
    console.log('');
    console.log('--- 异常详情 ---');
    report.abnormalFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.filename}`);
      console.log(`   原因: ${file.reason}`);
      console.log('');
    });
  });

program.parse();
