#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { parseFile, mergeDuplicates, summarizeByClassAndSize } = require('./processor');
const { printTerminalSummary, exportAll, printExportResult } = require('./exporter');

const program = new Command();

program
  .name('uniform-stat')
  .description('校服尺码统计工具 - 处理学生尺码数据，按班级和尺码汇总')
  .version('1.0.0');

program
  .command('process')
  .description('处理校服尺码数据文件')
  .argument('<file>', '输入文件路径 (支持 CSV 和 Excel)')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('--no-summary', '不显示终端摘要')
  .option('--no-export', '不导出文件')
  .action(async (file, options) => {
    try {
      const inputPath = path.resolve(file);
      
      if (!fs.existsSync(inputPath)) {
        console.error(`❌ 错误: 文件不存在 - ${inputPath}`);
        process.exit(1);
      }

      console.log(`📂 正在读取文件: ${inputPath}`);
      
      const parseResult = await parseFile(inputPath);
      
      console.log(`✅ 成功读取 ${parseResult.data.length} 条记录`);
      
      const { mergedData, duplicates } = mergeDuplicates(parseResult.data);
      const summary = summarizeByClassAndSize(mergedData);
      
      const result = {
        ...parseResult,
        mergedData,
        duplicates,
        summary,
      };

      if (options.summary) {
        printTerminalSummary(result);
      }

      if (options.export) {
        const outputDir = path.resolve(options.output);
        const exportResult = await exportAll(result, outputDir);
        printExportResult(exportResult);
      }

    } catch (error) {
      console.error(`\n❌ 处理失败: ${error.message}`);
      if (error.stack && program.opts().verbose) {
        console.error('\n详细错误信息:', error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('self-test')
  .description('运行自检，验证解析、边界处理和导出功能')
  .action(async () => {
    console.log('🧪 开始运行自检...\n');
    const selfTest = require('./self-test');
    const passed = await selfTest.run();
    
    if (passed) {
      console.log('\n✅ 所有测试通过！');
      process.exit(0);
    } else {
      console.log('\n❌ 部分测试失败');
      process.exit(1);
    }
  });

program.parse();
