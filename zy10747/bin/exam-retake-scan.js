#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ExamRetakeScanner = require('../src/scanner');

const args = process.argv.slice(2);

function showHelp() {
  console.log(`
考试记录文件补考资格扫描 CLI

用法:
  exam-retake-scan <数据目录> [选项]

选项:
  --json              输出JSON格式报告
  --output <文件>     将报告输出到指定文件
  --date <日期>       指定当前日期 (格式: YYYY-MM-DD)
  --cert-days <天数>  指定证明有效期天数 (默认: 365)
  --help              显示此帮助信息

示例:
  exam-retake-scan ./samples
  exam-retake-scan ./samples --json
  exam-retake-scan ./samples --output report.txt
  exam-retake-scan ./samples --date 2024-06-01
`);
}

function parseArgs(argv) {
  const options = {
    json: false,
    output: null,
    date: null,
    certDays: 365,
    directory: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
        showHelp();
        process.exit(0);
      case '--json':
        options.json = true;
        break;
      case '--output':
        options.output = argv[++i];
        break;
      case '--date':
        options.date = argv[++i];
        break;
      case '--cert-days':
        options.certDays = parseInt(argv[++i], 10);
        break;
      default:
        if (!options.directory && !arg.startsWith('--')) {
          options.directory = arg;
        }
    }
  }

  return options;
}

function main() {
  const options = parseArgs(args);

  if (!options.directory) {
    console.error('错误: 请指定数据目录');
    showHelp();
    process.exit(1);
  }

  try {
    const scanner = new ExamRetakeScanner({
      certExpireDays: options.certDays,
      currentDate: options.date
    });

    const results = scanner.scan(options.directory);
    
    let report;
    if (options.json) {
      report = JSON.stringify(scanner.generateJSONReport(results), null, 2);
    } else {
      report = scanner.generateReport(results);
    }

    if (options.output) {
      fs.writeFileSync(options.output, report, 'utf-8');
      console.log(`报告已写入: ${options.output}`);
    } else {
      console.log(report);
    }

    if (results.length === 0) {
      console.warn('\n警告: 未找到任何考试记录');
    }
  } catch (error) {
    console.error(`错误: ${error.message}`);
    process.exit(1);
  }
}

main();
