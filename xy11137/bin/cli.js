#!/usr/bin/env node

const { processRecords, readCsv, writeCsv, COLUMN_ORDER } = require('../src/index');
const fs = require('fs');
const path = require('path');

const EXIT_CODES = {
  SUCCESS: 0,
  PARTIAL_SUCCESS: 2,
  ERROR: 1
};

function parseArgs(args) {
  const options = {
    input: null,
    output: null,
    format: 'both',
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--input':
      case '-i':
        options.input = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
母婴护理站夜班交接补全 CLI

使用方法:
  母婴护理站夜班交接补全 --input <输入文件> --output <输出文件> [选项]

选项:
  --input, -i    输入CSV文件路径 (必需)
  --output, -o   输出CSV文件路径 (必需)
  --format, -f   输出格式: human|json|both (默认: both)
  --help, -h     显示此帮助信息

退出码:
  0   完全成功，无部分成功标记
  2   部分成功（包含跨夜时间处理、护理员换班补全等）
  1   错误

示例:
  母婴护理站夜班交接补全 -i sample/input.csv -o sample/output.csv
`);
}

function printHumanReadable(summary) {
  console.log('='.repeat(50));
  console.log('  母婴护理站夜班交接补全 - 处理汇总');
  console.log('='.repeat(50));
  console.log();
  console.log(`📊 总记录数: ${summary.totalRecords}`);
  console.log(`✅ 补全字段数: ${summary.filledFields}`);
  console.log(`🌙 跨夜记录数: ${summary.overnightRecords}`);
  console.log(`👩‍⚕️ 护理员补全数: ${summary.nurseChanges}`);
  console.log();
  
  if (summary.warnings.length > 0) {
    console.log('⚠️  警告信息:');
    summary.warnings.forEach((w, i) => {
      console.log(`  ${i + 1}. [${w.type}] 记录${w.recordIndex}: ${w.message}`);
    });
    console.log();
  }
  
  if (summary.errors.length > 0) {
    console.log('❌ 错误信息:');
    summary.errors.forEach((e, i) => {
      console.log(`  ${i + 1}. 记录${e.recordIndex}: ${e.message}`);
    });
    console.log();
  }
  
  if (summary.partialSuccess) {
    console.log('ℹ️  状态: 部分成功 (存在跨夜时间处理或补全操作，退出码=2)');
  } else {
    console.log('✅ 状态: 完全成功');
  }
  console.log();
  console.log('📋 关键业务列顺序:');
  COLUMN_ORDER.forEach((col, i) => {
    console.log(`  ${i + 1}. ${col}`);
  });
  console.log();
}

function printJsonOutput(summary, outputPath) {
  const jsonOutput = {
    tool: '母婴护理站夜班交接补全',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    summary: {
      totalRecords: summary.totalRecords,
      filledFields: summary.filledFields,
      overnightRecords: summary.overnightRecords,
      nurseChanges: summary.nurseChanges,
      partialSuccess: summary.partialSuccess
    },
    warnings: summary.warnings,
    errors: summary.errors,
    outputFile: outputPath ? path.resolve(outputPath) : null,
    columnOrder: COLUMN_ORDER
  };
  console.log(JSON.stringify(jsonOutput, null, 2));
}

function validateOptions(options) {
  const errors = [];
  
  if (!options.input) {
    errors.push('必须指定 --input 参数');
  } else if (!fs.existsSync(options.input)) {
    errors.push(`输入文件不存在: ${options.input}`);
  }
  
  if (!options.output) {
    errors.push('必须指定 --output 参数');
  }
  
  if (!['human', 'json', 'both'].includes(options.format)) {
    errors.push(`无效的 format 参数: ${options.format}，可选值: human|json|both`);
  }
  
  return errors;
}

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }
  
  const validationErrors = validateOptions(options);
  if (validationErrors.length > 0) {
    console.error('❌ 参数错误:');
    validationErrors.forEach(e => console.error(`  - ${e}`));
    console.error();
    printHelp();
    process.exit(EXIT_CODES.ERROR);
  }
  
  try {
    const records = readCsv(options.input);
    const { results, summary } = processRecords(records);
    
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    writeCsv(options.output, results);
    
    if (options.format === 'human' || options.format === 'both') {
      printHumanReadable(summary);
    }
    
    if (options.format === 'json' || options.format === 'both') {
      if (options.format === 'both') {
        console.log('--- JSON 输出 ---');
      }
      printJsonOutput(summary, options.output);
    }
    
    const exitCode = summary.errors.length > 0 
      ? EXIT_CODES.ERROR 
      : summary.partialSuccess 
        ? EXIT_CODES.PARTIAL_SUCCESS 
        : EXIT_CODES.SUCCESS;
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ 处理出错:', error.message);
    console.error(error.stack);
    process.exit(EXIT_CODES.ERROR);
  }
}

main();