const LedgerProcessor = require('../src/processor');
const ReportGenerator = require('../src/report');
const path = require('path');

async function runTest() {
  console.log('========================================');
  console.log('  农资门店农资实名台账 CLI - 测试运行');
  console.log('========================================\n');

  const inputFile = path.join(__dirname, '../data/sample-ledger.csv');
  
  console.log('测试模式 1: 简洁模式（默认）');
  console.log('----------------------------------------');
  
  const processor1 = new LedgerProcessor({ verbose: false });
  await processor1.load(inputFile);
  processor1.process();
  await processor1.saveOutput(path.join(__dirname, '../output/test1-cleaned.csv'));
  
  const report1 = new ReportGenerator(processor1);
  await report1.generate(path.join(__dirname, '../output/test1-report.md'));
  
  console.log('\n测试模式 2: 详细模式（-v）');
  console.log('----------------------------------------');
  
  const processor2 = new LedgerProcessor({ verbose: true });
  await processor2.load(inputFile);
  processor2.process();
  await processor2.saveOutput(path.join(__dirname, '../output/test2-cleaned.csv'));
  
  const report2 = new ReportGenerator(processor2);
  await report2.generate(path.join(__dirname, '../output/test2-report.md'));
  
  console.log('\n测试模式 3: 保留所有记录（-k）');
  console.log('----------------------------------------');
  
  const processor3 = new LedgerProcessor({ verbose: true, keepAll: true });
  await processor3.load(inputFile);
  processor3.process();
  await processor3.saveOutput(path.join(__dirname, '../output/test3-all-records.csv'));
  
  console.log('\n========================================');
  console.log('  测试完成！请查看 output 目录');
  console.log('========================================');
}

runTest().catch(console.error);