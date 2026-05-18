#!/usr/bin/env node

const { parsePrintQueue } = require('./parser');
const { validateJobs, generateRerunJobs } = require('./validator');
const { generateReport, printConsoleSummary } = require('./reporter');

const EXIT_CODES = {
  SUCCESS: 0,
  PARTIAL_SUCCESS: 2,
  ERROR: 1
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    inputFile: null,
    mode: 'full',
    outputDir: './output'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--preview' || arg === '-p') {
      options.mode = 'preview';
    } else if (arg === '--output' || arg === '-o') {
      options.outputDir = args[++i];
    } else if (!options.inputFile) {
      options.inputFile = arg;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
文印店打印队列排错 CLI

使用方法:
  pq-debug <队列文件>          完整执行: 解析 + 校验 + 生成报告
  pq-debug <队列文件> --preview  预览模式，仅显示问题不生成文件
  pq-debug <队列文件> -o ./out  指定输出目录

命令顺序:
  1. 预览: pq-debug queue.txt --preview
  2. 正式执行: pq-debug queue.txt
  3. 查看报告: cat output/debug-report-*.txt

退出码:
  0 - 完全成功，无问题
  2 - 部分成功，存在警告或可重跑任务
  1 - 存在严重错误
`);
}

async function main() {
  const options = parseArgs();

  if (!options.inputFile || options.inputFile === '--help' || options.inputFile === '-h') {
    printHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }

  try {
    console.log(`📂 正在解析打印队列: ${options.inputFile}`);
    const jobs = parsePrintQueue(options.inputFile);
    console.log(`✅ 解析完成，共发现 ${jobs.length} 个打印任务`);

    console.log('🔍 正在校验任务...');
    const validationResult = validateJobs(jobs);
    const rerunJobs = generateRerunJobs(jobs);

    printConsoleSummary(validationResult, rerunJobs);

    if (options.mode === 'preview') {
      console.log('📋 预览模式 - 不生成报告文件');
    } else {
      console.log('📝 正在生成报告...');
      const reportResult = generateReport(jobs, validationResult, rerunJobs, {
        outputDir: options.outputDir
      });
      console.log(`✅ 报告已生成: ${reportResult.reportPath}`);
      if (reportResult.rerunPath) {
        console.log(`🔄 可复跑队列已生成: ${reportResult.rerunPath}`);
      }
    }

    const hasErrors = validationResult.summary.errors > 0;
    const hasWarningsOrRerun = validationResult.summary.warnings > 0 || rerunJobs.length > 0;

    if (hasErrors) {
      process.exit(EXIT_CODES.ERROR);
    } else if (hasWarningsOrRerun) {
      console.log('⚡ 检测到部分问题，退出码: 2 (PARTIAL_SUCCESS)');
      process.exit(EXIT_CODES.PARTIAL_SUCCESS);
    } else {
      process.exit(EXIT_CODES.SUCCESS);
    }

  } catch (error) {
    console.error('❌ 执行出错:', error.message);
    process.exit(EXIT_CODES.ERROR);
  }
}

main();
