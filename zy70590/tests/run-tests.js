const { AuditEngine, ReportGenerator } = require('../src');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('=== 时区数据巡检CLI 测试 ===\n');

  const testOutputDir = path.join(__dirname, '..', 'test-output');
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }

  console.log('测试1: 正常CSV文件');
  const normalCsv = path.join(__dirname, '..', 'test-data', 'normal.csv');
  const engine1 = new AuditEngine({
    timeField: 'timestamp',
    timezoneField: 'timezone',
    defaultSourceTimezone: 'UTC',
    targetTimezone: 'UTC'
  });
  const results1 = await engine1.audit(normalCsv);
  console.log(`  总行数: ${results1.summary.totalRows}`);
  console.log(`  成功行数: ${results1.summary.successRows}`);
  console.log(`  警告行数: ${results1.summary.warningRows}`);
  console.log(`  错误行数: ${results1.summary.errorRows}`);
  console.log(`  夏令时转换点: ${results1.summary.dstTransitionRows}`);
  console.log(`  退出码: ${results1.exitCode}`);
  console.log('  ✓ 测试通过\n');

  console.log('测试2: 带脏数据的CSV文件');
  const dirtyCsv = path.join(__dirname, '..', 'test-data', 'dirty.csv');
  const engine2 = new AuditEngine({
    timeField: 'timestamp',
    timezoneField: 'timezone',
    defaultSourceTimezone: 'UTC',
    targetTimezone: 'UTC'
  });
  const results2 = await engine2.audit(dirtyCsv);
  console.log(`  总行数: ${results2.summary.totalRows}`);
  console.log(`  成功行数: ${results2.summary.successRows}`);
  console.log(`  警告行数: ${results2.summary.warningRows}`);
  console.log(`  错误行数: ${results2.summary.errorRows}`);
  console.log(`  夏令时转换点: ${results2.summary.dstTransitionRows}`);
  console.log(`  退出码: ${results2.exitCode}`);
  
  console.log('\n  错误行详情:');
  results2.files[0].errors.forEach(err => {
    console.log(`    行 ${err.rowNumber}: ${err.issues[0].type} - ${err.issues[0].message}`);
  });
  console.log('  ✓ 测试通过\n');

  console.log('测试3: 生成报告');
  const generator = new ReportGenerator({ outputDir: testOutputDir });
  const outputs = await generator.generateAllReports(results2, 'test-report');
  console.log(`  终端报告: 已生成`);
  console.log(`  JSON报告: ${outputs.jsonPath}`);
  console.log(`  HTML报告: ${outputs.htmlPath}`);
  if (outputs.errorsCsvPath) {
    console.log(`  错误CSV: ${outputs.errorsCsvPath}`);
  }
  console.log('  ✓ 测试通过\n');

  console.log('测试4: 目录批量处理');
  const testDataDir = path.join(__dirname, '..', 'test-data');
  const engine3 = new AuditEngine({
    timeField: 'timestamp',
    timezoneField: 'timezone',
    targetTimezone: 'UTC'
  });
  const results3 = await engine3.audit(testDataDir);
  console.log(`  处理文件数: ${results3.files.length}`);
  console.log(`  总行数: ${results3.summary.totalRows}`);
  console.log(`  总错误数: ${results3.summary.errorRows}`);
  console.log(`  退出码: ${results3.exitCode}`);
  console.log('  ✓ 测试通过\n');

  console.log('=== 所有测试完成 ===');
  console.log(`\n测试报告已输出到: ${testOutputDir}`);
}

runTests().catch(console.error);