#!/usr/bin/env node

const path = require('path');
const BillingProcessor = require('./processor');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: null,
    output: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        options.input = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
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
账单流水文件套餐超额核算 CLI

用法:
  node src/cli.js [选项]

选项:
  -i, --input <目录>   输入文件目录 (默认: samples/)
  -o, --output <目录>  输出报告目录 (默认: reports/)
  -h, --help           显示帮助信息

功能说明:
  - 自动检测CSV格式的账单流水文件
  - 暴露数据质量问题（缺失字段、格式错误等）
  - 计算套餐超额费用（数据、语音、短信）
  - 计算减免差异
  - 追踪特殊记录（跨月补写、负数冲正、重复计量）
  - 保留原始文件名和行号信息
  - 幂等性保证：重复运行同一批文件不会重复处理

输出文件:
  - issues_detected.json  检测到的问题详情
  - overage_results.json  超额核算结果
  - summary_report.md    汇总报告（Markdown格式）
  - .processed_files_hash  已处理文件哈希记录
`);
}

function printResult(result) {
  console.log('\n========================================');
  console.log('  账单流水文件套餐超额核算');
  console.log('========================================\n');

  console.log(`状态: ${result.success ? '成功' : '失败'}`);
  console.log(`消息: ${result.message}`);
  console.log(`处理文件数: ${result.filesProcessed}`);
  if (result.filesSkipped) {
    console.log(`跳过文件数: ${result.filesSkipped}`);
  }
  console.log();

  if (result.issues && result.issues.length > 0) {
    console.log(`检测到 ${result.issues.length} 个问题:`);
    const issueGroups = {};
    result.issues.forEach(issue => {
      if (!issueGroups[issue.type]) {
        issueGroups[issue.type] = [];
      }
      issueGroups[issue.type].push(issue);
    });
    Object.entries(issueGroups).forEach(([type, issues]) => {
      console.log(`  - ${type}: ${issues.length} 个`);
    });
    console.log();
  }

  if (result.totals) {
    console.log('核算汇总:');
    console.log(`  用户总数: ${result.totals.userCount}`);
    console.log(`  超额用户数: ${result.totals.overageUserCount}`);
    console.log(`  总超额费用: ${result.totals.totalOverageFee} 元`);
    console.log(`  减免差异总额: ${result.totals.totalDiscountDifference} 元`);
    console.log();
  }

  if (result.success && result.filesProcessed > 0) {
    console.log('报告已生成到输出目录:');
    console.log('  - issues_detected.json  (问题详情)');
    console.log('  - overage_results.json  (核算结果)');
    console.log('  - summary_report.md    (汇总报告)');
    console.log();
  }
}

function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const inputDir = options.input ? path.resolve(options.input) : null;
  const outputDir = options.output ? path.resolve(options.output) : null;

  const processor = new BillingProcessor(inputDir, outputDir);
  
  try {
    const result = processor.process();
    printResult(result);
  } catch (error) {
    console.error('处理失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
