#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ExportQueueAnalyzer = require('../src/analyzer');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    format: 'text',
    largeFileThreshold: 100 * 1024 * 1024,
    duplicateTimeWindow: 5 * 60 * 1000,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-i':
      case '--input':
        options.input = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-f':
      case '--format':
        options.format = args[++i];
        break;
      case '-t':
      case '--threshold':
        const threshold = parseFloat(args[++i]);
        if (!isNaN(threshold)) {
          options.largeFileThreshold = threshold * 1024 * 1024;
        }
        break;
      case '-w':
      case '--window':
        const window = parseInt(args[++i]);
        if (!isNaN(window)) {
          options.duplicateTimeWindow = window * 1000;
        }
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        if (!options.input && fs.existsSync(args[i])) {
          options.input = args[i];
        }
    }
  }

  return options;
}

function showHelp() {
  console.log(`
导出任务记录大文件排队分析 CLI

用法:
  export-queue-analyzer [选项] <输入文件>

选项:
  -i, --input <文件>      输入JSON文件路径 (必需)
  -o, --output <文件>     输出文件路径 (可选，默认输出到控制台)
  -f, --format <格式>     输出格式: text|json (默认: text)
  -t, --threshold <MB>    大文件阈值，单位MB (默认: 100)
  -w, --window <秒>       重复任务时间窗口，单位秒 (默认: 300)
  -h, --help              显示帮助信息

示例:
  export-queue-analyzer -i samples/normal.json
  export-queue-analyzer --input samples/normal.json --format json --output result.json
  export-queue-analyzer -i samples/abnormal.json -t 50 -w 60

业务字段说明:
  taskId        任务ID (必需)
  userId        用户ID (必需)
  userName      用户名 (可选)
  fileName      文件名 (必需)
  fileSize      文件大小，单位字节 (必需)
  exportType    导出类型 (可选)
  status        状态: queued|processing|success|failed|cancelled (必需)
  statusReason  状态原因 (可选)
  createdAt     创建时间 (ISO格式，必需)
  startedAt     开始处理时间 (可选)
  completedAt   完成时间 (可选)
  cancelledAt   取消时间 (可选)
  cancelledBy   取消方: user|system (可选)
  cancelReason  取消原因 (可选)
  isCompression 是否压缩任务 (可选)
  errorMessage  错误信息 (可选)
  retryCount    重试次数 (可选)
  `);
}

function loadRecords(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data.records && Array.isArray(data.records)) {
      return data.records;
    }
    
    throw new Error('数据格式错误：需要数组或包含records字段的对象');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`错误: 文件不存在 - ${filePath}`);
    } else if (error instanceof SyntaxError) {
      console.error(`错误: JSON格式无效 - ${filePath}`);
    } else {
      console.error(`错误: ${error.message}`);
    }
    process.exit(1);
  }
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.input) {
    console.error('错误: 请指定输入文件');
    console.error('使用 -h 或 --help 查看帮助');
    process.exit(1);
  }

  const records = loadRecords(options.input);
  
  const analyzer = new ExportQueueAnalyzer({
    largeFileThreshold: options.largeFileThreshold,
    duplicateTimeWindow: options.duplicateTimeWindow
  });

  const result = analyzer.analyze(records);
  const output = analyzer.formatOutput(result, options.format);

  if (options.output) {
    try {
      const outputPath = path.resolve(options.output);
      fs.writeFileSync(outputPath, output, 'utf-8');
      console.log(`分析结果已保存到: ${outputPath}`);
    } catch (error) {
      console.error(`写入文件失败: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.log(output);
  }
}

main();
