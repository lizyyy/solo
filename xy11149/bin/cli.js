#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const { processDirectory, readReport } = require('../src/processor');

const program = new Command();

program
  .name('garden-archive')
  .description('园艺养护队园艺病害归档数据处理 CLI')
  .version('1.0.0');

program
  .command('preview')
  .description('预览数据处理结果（不写入文件）')
  .option('-i, --input <dir>', '输入目录', './data/input')
  .option('-o, --output <dir>', '输出目录', './data/output')
  .action(async (options) => {
    const inputDir = path.resolve(options.input);
    const outputDir = path.resolve(options.output);
    
    console.log('=== 园艺病害归档数据预览 ===');
    console.log(`输入目录: ${inputDir}`);
    console.log(`输出目录: ${outputDir}`);
    console.log('');
    
    try {
      const result = await processDirectory(inputDir, outputDir, true);
      
      console.log(`处理文件数: ${result.filesProcessed}`);
      console.log(`总记录数: ${result.stats.total}`);
      console.log(`有效记录: ${result.stats.valid}`);
      console.log(`异常记录: ${result.stats.invalid}`);
      console.log(`重复拍摄: ${result.stats.duplicates}`);
      console.log(`位置缺失: ${result.stats.missingLocation}`);
      console.log('');
      
      if (result.invalid.length > 0) {
        console.log('=== 异常记录摘要 ===');
        result.invalid.slice(0, 10).forEach(item => {
          console.log(`[${item.errorType}] ${item.fileName} 行${item.rowIndex}: ${item.errorMessage}`);
        });
        if (result.invalid.length > 10) {
          console.log(`... 还有 ${result.invalid.length - 10} 条异常记录`);
        }
      }
      
      console.log('');
      console.log('预览完成！执行 garden-archive run 开始正式处理');
    } catch (error) {
      console.error('预览失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('正式执行数据处理')
  .option('-i, --input <dir>', '输入目录', './data/input')
  .option('-o, --output <dir>', '输出目录', './data/output')
  .action(async (options) => {
    const inputDir = path.resolve(options.input);
    const outputDir = path.resolve(options.output);
    
    console.log('=== 园艺病害归档数据处理 ===');
    console.log(`输入目录: ${inputDir}`);
    console.log(`输出目录: ${outputDir}`);
    console.log('');
    
    try {
      const result = await processDirectory(inputDir, outputDir, false);
      
      console.log(`处理文件数: ${result.filesProcessed}`);
      console.log(`总记录数: ${result.stats.total}`);
      console.log(`有效记录: ${result.stats.valid}`);
      console.log(`异常记录: ${result.stats.invalid}`);
      console.log(`重复拍摄: ${result.stats.duplicates}`);
      console.log(`位置缺失: ${result.stats.missingLocation}`);
      console.log('');
      console.log('输出文件:');
      console.log(`  - valid-records.csv (有效记录)`);
      console.log(`  - invalid-records.csv (异常记录，待人工复核)`);
      console.log(`  - report.json (处理报告)`);
      console.log('');
      console.log('处理完成！执行 garden-archive report 查看详细报告');
    } catch (error) {
      console.error('处理失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('report')
  .description('查看处理报告')
  .option('-o, --output <dir>', '输出目录', './data/output')
  .action(async (options) => {
    const outputDir = path.resolve(options.output);
    
    try {
      const report = await readReport(outputDir);
      
      if (!report) {
        console.log('未找到处理报告，请先执行 garden-archive run');
        process.exit(1);
      }
      
      console.log('=== 园艺病害归档处理报告 ===');
      console.log(`处理时间: ${new Date(report.processedAt).toLocaleString('zh-CN')}`);
      console.log(`输入目录: ${report.inputDir}`);
      console.log(`输出目录: ${report.outputDir}`);
      console.log('');
      console.log('统计数据:');
      console.log(`  处理文件数: ${report.filesProcessed}`);
      console.log(`  总记录数: ${report.stats.total}`);
      console.log(`  有效记录: ${report.stats.valid}`);
      console.log(`  异常记录: ${report.stats.invalid}`);
      console.log(`  重复拍摄: ${report.stats.duplicates}`);
      console.log(`  位置缺失: ${report.stats.missingLocation}`);
      console.log('');
      console.log('异常记录分类:');
      console.log(`  - 重复拍摄: 相同时间-位置-病害类型重复，需确认是否重复拍摄`);
      console.log(`  - 位置缺失: 病害发生位置未填写，需补充位置信息`);
      console.log(`  - 字段缺失: 其他必填字段缺失，需补充完整`);
      console.log(`  - 数据异常: 数据格式或范围不正确，需核对修正`);
    } catch (error) {
      console.error('读取报告失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
