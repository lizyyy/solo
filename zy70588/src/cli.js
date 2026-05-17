#!/usr/bin/env node

const { Command } = require('commander');
const { parseSampleRate, parseLogFile } = require('./parser');
const { aggregateGroups } = require('./statistics');
const { printTerminalSummary, generateReports } = require('./reporter');
const path = require('path');

const program = new Command();

program
  .name('log-reduce')
  .description('日志采样还原CLI - 从采样日志估算真实错误量')
  .version('1.0.0');

program
  .option('-i, --input <file>', '输入日志文件路径 (必填)')
  .option('-s, --sample-rate <rate>', '采样率，支持小数或百分比 (默认: 0.1)', '0.1')
  .option('-g, --group-by <fields>', '分组字段，逗号分隔 (默认: error_type)', 'error_type')
  .option('-c, --confidence <level>', '置信水平 (0.90, 0.95, 0.99) (默认: 0.95)', '0.95')
  .option('-o, --output <path>', '输出报告路径 (不含扩展名)')
  .option('-q, --quiet', '不输出终端摘要', false)
  .action(async (options) => {
    try {
      if (!options.input) {
        console.error('错误: 必须指定输入文件 --input');
        program.help();
        process.exit(1);
      }
      
      const sampleRate = parseSampleRate(options.sampleRate);
      const groupFields = options.groupBy.split(',').map(f => f.trim());
      const confidenceLevel = parseFloat(options.confidence);
      
      console.log(`正在解析日志文件: ${options.input}`);
      console.log(`采样率: ${(sampleRate * 100).toFixed(1)}%`);
      console.log(`分组字段: ${groupFields.join(', ')}`);
      console.log();
      
      const parseResults = await parseLogFile(options.input, {
        sampleRate,
        groupFields
      });
      
      const aggregated = aggregateGroups(parseResults, confidenceLevel);
      
      if (!options.quiet) {
        printTerminalSummary(aggregated, { confidenceLevel });
      }
      
      if (options.output) {
        const reports = generateReports(aggregated, options.output);
        console.log('✅ 报告已生成:');
        for (const report of reports) {
          console.log(`   ${report.type.toUpperCase()}: ${path.resolve(report.path)}`);
        }
        console.log();
      }
      
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证所有功能模块')
  .action(async () => {
    console.log('🧪 正在运行自检...\n');
    require('../tests/self-test');
  });

program
  .command('demo')
  .description('运行演示，使用内置测试数据')
  .action(async () => {
    try {
      const sampleRate = 0.1;
      const groupFields = ['service', 'error_type'];
      
      console.log('🎬 运行演示模式\n');
      console.log(`采样率: 10%`);
      console.log(`分组字段: service, error_type\n`);
      
      const testLogPath = path.join(__dirname, '../tests/sample-logs.txt');
      
      const parseResults = await parseLogFile(testLogPath, {
        sampleRate,
        groupFields
      });
      
      const aggregated = aggregateGroups(parseResults, 0.95);
      printTerminalSummary(aggregated, { confidenceLevel: 0.95 });
      
      const outputPath = path.join(process.cwd(), 'demo-report');
      const reports = generateReports(aggregated, outputPath);
      
      console.log('✅ 演示报告已生成:');
      for (const report of reports) {
        console.log(`   ${report.type.toUpperCase()}: ${path.resolve(report.path)}`);
      }
      console.log();
      
    } catch (error) {
      console.error('❌ 演示错误:', error.message);
      process.exit(1);
    }
  });

program.parse();
