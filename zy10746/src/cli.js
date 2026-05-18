#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { processTravelExceptions, generateReports } = require('./index');

function printHeader() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                差旅政策表例外审批汇总 CLI                     ║');
  console.log('║            Travel Policy Exception Summary CLI               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

function printUsage() {
  console.log('使用方法:');
  console.log('  node src/cli.js <输入目录> [输出目录]');
  console.log('');
  console.log('参数说明:');
  console.log('  输入目录   - 包含差旅政策例外审批数据文件的目录 (支持 .csv, .xlsx, .json)');
  console.log('  输出目录   - 汇总报告输出目录 (可选，默认为 ./output)');
  console.log('');
  console.log('示例:');
  console.log('  node src/cli.js ./sample-data ./output');
  console.log('');
}

function printSummary(stats, reports) {
  console.log('');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('                      处理完成总结                             ');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`📊 处理文件数: ${stats.totalFiles}`);
  console.log(`✅ 成功处理: ${stats.successFiles}`);
  console.log(`❌ 处理失败: ${stats.failedFiles}`);
  console.log(`📝 总例外记录: ${stats.totalExceptions}`);
  console.log('');
  console.log('📂 生成的报告文件:');
  reports.forEach((report, index) => {
    console.log(`  ${index + 1}. ${report.fileName}`);
    console.log(`     用途: ${report.description}`);
    console.log(`     路径: ${report.fullPath}`);
    console.log('');
  });
  console.log('══════════════════════════════════════════════════════════════');
}

async function main() {
  printHeader();

  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const inputDir = args[0];
  const outputDir = args[1] || path.join(process.cwd(), 'output');

  if (!fs.existsSync(inputDir)) {
    console.log('❌ 错误: 输入目录不存在');
    console.log(`   路径: ${inputDir}`);
    console.log('');
    printUsage();
    process.exit(1);
  }

  console.log(`📂 输入目录: ${inputDir}`);
  console.log(`📤 输出目录: ${outputDir}`);
  console.log('');

  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('🔍 开始处理差旅政策例外审批数据...');
    console.log('');

    const result = await processTravelExceptions(inputDir, outputDir);
    const reports = await generateReports(result, outputDir);
    
    printSummary(result.stats, reports);
    
  } catch (error) {
    console.log('');
    console.log('❌ 处理过程中发生错误:');
    console.log(`   ${error.message}`);
    console.log('');
    console.log('详细错误信息:');
    console.log(error.stack);
    process.exit(1);
  }
}

main();
