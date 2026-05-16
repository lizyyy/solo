'use strict';

const { parseArgs } = require('./cli.js');
const { convertCSV } = require('./converter.js');
const { generateReports } = require('./reporter.js');

async function main() {
  const options = parseArgs();
  const result = await convertCSV(options);
  await generateReports(result, options);
  printSummary(result);
  process.exit(result.success ? 0 : 1);
}

function printSummary(result) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 转换摘要');
  console.log('='.repeat(60));
  console.log(`输入文件: ${result.inputFile}`);
  console.log(`探测编码: ${result.detectedEncoding}`);
  console.log(`总行数: ${result.totalRows}`);
  console.log(`成功行数: ${result.successRows}`);
  console.log(`坏行数: ${result.badRows}`);
  console.log(`重复行数: ${result.duplicateRows}`);
  console.log(`输出文件: ${result.outputFile}`);
  console.log(`坏行文件: ${result.badRowsFile}`);
  console.log(`报告目录: ${result.reportDir}`);
  console.log('='.repeat(60));
  
  if (result.badRows > 0) {
    console.log(`⚠️  检测到 ${result.badRows} 行坏数据，请查看坏行文件`);
  }
  
  if (result.success) {
    console.log('✅ 转换完成!');
  } else {
    console.log('❌ 转换失败!');
  }
  console.log('');
}

module.exports = { main };
