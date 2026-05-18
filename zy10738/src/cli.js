#!/usr/bin/env node

import { Command } from 'commander';
import { parseFile } from './parser.js';
import { validateRecords } from './validator.js';
import { matchNoPlateVehicles } from './matcher.js';
import { generateSummary } from './summarizer.js';
import { generateReports, printConsoleSummary } from './reporter.js';
import path from 'path';

const program = new Command();

program
  .name('parking-matcher')
  .description('停车场流水无牌车匹配复核工具')
  .version('1.0.0');

program
  .command('run')
  .description('执行无牌车匹配复核')
  .argument('<file>', '停车场流水文件路径 (CSV/Excel)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--no-console', '不打印控制台摘要')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      const outputDir = path.resolve(options.output);

      console.log('开始处理停车场流水文件...');
      console.log(`输入文件: ${filePath}`);
      console.log(`输出目录: ${outputDir}`);

      console.log('\n[1/5] 解析文件...');
      const parseResult = await parseFile(filePath);
      console.log(`  解析完成: 共 ${parseResult.records.length} 条记录, ${parseResult.parseErrors.length} 个解析错误`);

      console.log('\n[2/5] 校验数据...');
      const validateResult = validateRecords(parseResult.records);
      console.log(`  校验完成: ${validateResult.validationErrors.length} 条记录存在异常`);

      console.log('\n[3/5] 匹配无牌车...');
      const matchResult = matchNoPlateVehicles(validateResult.validRecords);
      console.log(`  匹配完成: ${matchResult.matchedResults.length} 条匹配成功, ${matchResult.unmatchedRecords.length} 条未匹配`);

      console.log('\n[4/5] 生成汇总...');
      const summary = generateSummary(parseResult, validateResult, matchResult);

      console.log('\n[5/5] 生成报告...');
      const reportPaths = generateReports(summary, parseResult, validateResult, matchResult, outputDir);
      console.log('  报告生成完成:');
      console.log(`    汇总报告: ${reportPaths.summaryReport}`);
      console.log(`    匹配明细: ${reportPaths.matchReport}`);
      console.log(`    异常报告: ${reportPaths.exceptionReport}`);

      if (options.console !== false) {
        printConsoleSummary(summary);
      }

      console.log('处理完成！\n');

    } catch (error) {
      console.error('\n处理失败:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

program.parse();
