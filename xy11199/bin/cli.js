#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { processFiles, toCSV, toJSON, toMarkdown } = require('../src/core');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    files: [],
    output: null,
    format: 'csv',
    continueOnError: false,
    help: false,
    stats: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-f':
      case '--format':
        options.format = args[++i]?.toLowerCase() || 'csv';
        break;
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--no-stats':
        options.stats = false;
        break;
      default:
        if (fs.existsSync(arg) || arg.includes('*')) {
          if (arg.includes('*')) {
            const glob = require('glob');
            const matches = glob.sync(arg);
            options.files.push(...matches);
          } else {
            options.files.push(arg);
          }
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
旅拍客服组旅拍照片交付 CLI 工具

用法:
  lvpai-delivery [选项] <文件...>

选项:
  -h, --help              显示帮助信息
  -o, --output <文件>     指定输出文件路径
  -f, --format <格式>     输出格式: csv, json, md (默认: csv)
  --continue-on-error     遇到错误时继续处理其他文件
  --no-stats              不显示统计信息

示例:
  # 处理单个 CSV 文件
  lvpai-delivery sanya-photos.csv -o result.csv

  # 处理多个文件，输出 JSON 格式
  lvpai-delivery *.csv -o result.json -f json

  # 遇到错误继续处理，输出 Markdown
  lvpai-delivery *.csv --continue-on-error -o report.md -f md

业务字段说明:
  订单号        - 客户订单编号 (必填)
  客户姓名      - 客户姓名 (必填)
  拍摄地点      - 拍摄城市/地点 (必填)
  文件名        - 照片文件名 (必填)
  拍摄日期      - 拍摄日期
  是否补拍      - 是否为补拍照片 (是/否)
  摄影师        - 摄影师姓名
  备注          - 备注信息

元数据字段:
  _source.file  - 来源文件路径
  _source.line  - 来源文件行号
  _reshootInfo  - 补拍追踪信息
  _validation   - 验证结果
`);
}

function printStats(stats) {
  console.log('\n📊 处理统计:');
  console.log(`  文件总数: ${stats.totalFiles}`);
  console.log(`  成功处理: ${stats.processedFiles}`);
  console.log(`  处理失败: ${stats.failedFiles}`);
  console.log(`  记录总数: ${stats.totalRecords}`);
  console.log(`  有效记录: ${stats.validRecords}`);
  console.log(`  重复记录: ${stats.duplicateRecords}`);
  console.log(`  补拍记录: ${stats.reshootRecords}`);
}

function printErrors(errors) {
  if (errors.length === 0) return;
  
  console.log('\n⚠️  错误信息:');
  errors.forEach(err => {
    console.log(`  ${path.basename(err.file)}: ${err.error}`);
  });
}

function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.files.length === 0) {
    console.error('❌ 错误: 请指定要处理的文件');
    printHelp();
    process.exit(1);
  }

  try {
    const result = processFiles(options.files, {
      continueOnError: options.continueOnError
    });

    let output;
    switch (options.format) {
      case 'json':
        output = toJSON(result);
        break;
      case 'md':
      case 'markdown':
        output = toMarkdown(result.data);
        break;
      case 'csv':
      default:
        output = toCSV(result.data);
    }

    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(`✅ 结果已保存到: ${options.output}`);
    } else {
      console.log(output);
    }

    if (options.stats) {
      printStats(result.stats);
      printErrors(result.errors);
    }

    if (result.errors.length > 0) {
      process.exit(2);
    }
  } catch (error) {
    console.error(`❌ 处理失败: ${error.message}`);
    process.exit(1);
  }
}

main();
