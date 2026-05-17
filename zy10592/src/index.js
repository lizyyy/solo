#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const { parseLogs } = require('./parser');
const { aggregateData, deduplicateRequests } = require('./aggregator');
const { calculatePercentiles } = require('./percentile');
const { generateReports } = require('./reporter');
const { setupOutputDir, getTimestamp } = require('./output');

const program = new Command();

program
  .name('latency-percentile')
  .description('接口耗时分位分析CLI工具 - 按路径、租户和状态码分析访问日志')
  .version('1.0.0');

program
  .option('-i, --input <dir>', '输入目录，包含访问日志文件', './logs')
  .option('-o, --output <dir>', '输出目录，存放分析结果', './results')
  .option('-p, --percentiles <values>', '分位值列表，逗号分隔', '50,90,95,99')
  .option('-s, --slow-threshold <ms>', '慢请求阈值（毫秒）', '3000')
  .option('-e, --error-samples <count>', '每个分组保留的异常样本数', '10')
  .option('-f, --log-format <format>', '日志格式：json, nginx, custom', 'json')
  .action(async (options) => {
    console.log('🚀 接口耗时分位分析工具启动');
    console.log(`📂 输入目录: ${options.input}`);
    console.log(`📂 输出目录: ${options.output}`);
    
    const timestamp = getTimestamp();
    const outputDir = setupOutputDir(options.output, timestamp);
    
    console.log(`⏱️  运行标识: ${timestamp}`);
    console.log('----------------------------------------\n');
    
    try {
      const { records, badLines } = await parseLogs(options.input, options);
      console.log(`✅ 日志解析完成: ${records.length} 条有效记录, ${badLines.length} 条坏行`);
      
      const { dedupedRecords, deduplicationStats } = deduplicateRequests(records);
      console.log(`✅ 去重完成: 原始 ${records.length} 条 → 去重后 ${dedupedRecords.length} 条`);
      
      const aggregated = aggregateData(dedupedRecords);
      console.log(`✅ 数据聚合完成: ${aggregated.length} 个分组`);
      
      const percentiles = options.percentiles.split(',').map(Number);
      const results = calculatePercentiles(aggregated, percentiles);
      console.log(`✅ 分位计算完成: 分位值 ${percentiles.join(', ')}`);
      
      await generateReports(results, {
        badLines,
        deduplicationStats,
        outputDir,
        timestamp,
        slowThreshold: Number(options.slowThreshold),
        errorSamples: Number(options.errorSamples),
        options
      });
      
      console.log('\n----------------------------------------');
      console.log('🎉 分析完成！结果已保存到:', outputDir);
      console.log('   📄 summary.txt - 终端摘要');
      console.log('   📄 results.json - 机器可读结果');
      console.log('   📄 report.md - 友好报告（可发给同事）');
      console.log('   📄 bad_lines.csv - 坏行记录');
      console.log('   📄 slow_samples.csv - 慢请求样本');
      
    } catch (error) {
      console.error('\n❌ 处理失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse();
