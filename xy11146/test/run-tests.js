const path = require('path');
const fs = require('fs');
const MealCouponAuditor = require('../src/auditor');

const RULES_PATH = path.join(__dirname, '..', 'config', 'rules.json');

async function runTest(testName, testFunc) {
  console.log(`\n=======================================`);
  console.log(`测试: ${testName}`);
  console.log(`=======================================`);
  
  try {
    await testFunc();
    console.log(`✅ ${testName} - 通过`);
    return true;
  } catch (error) {
    console.log(`❌ ${testName} - 失败: ${error.message}`);
    return false;
  }
}

async function testEmptyDirectory() {
  const emptyDir = path.join(__dirname, '..', 'data', 'empty-dir');
  const auditor = new MealCouponAuditor(RULES_PATH);
  const results = await auditor.auditPath(emptyDir);
  
  if (results.summary.totalRecords !== 0) {
    throw new Error(`空目录应该返回0条记录，实际返回${results.summary.totalRecords}`);
  }
  
  console.log('空目录稽核成功，总记录数: 0');
}

async function testBadRows() {
  const badRowsFile = path.join(__dirname, '..', 'data', 'bad-rows.csv');
  const auditor = new MealCouponAuditor(RULES_PATH);
  const results = await auditor.auditPath(badRowsFile);
  
  console.log(`总记录数: ${results.summary.totalRecords}`);
  console.log(`格式错误数: ${results.summary.formatErrors}`);
  
  if (results.summary.formatErrors < 2) {
    throw new Error(`坏行数据应该至少检测到2个格式错误`);
  }
}

async function testSampleData() {
  const sampleFile = path.join(__dirname, '..', 'data', 'sample.csv');
  const auditor = new MealCouponAuditor(RULES_PATH);
  const results = await auditor.auditPath(sampleFile);
  
  console.log(`总记录数: ${results.summary.totalRecords}`);
  console.log(`正常记录: ${results.summary.normalRecords}`);
  console.log(`格式错误: ${results.summary.formatErrors}`);
  console.log(`跨日补传: ${results.summary.crossDayUploads}`);
  console.log(`等级变更: ${results.summary.levelChanges}`);
  console.log(`可复跑输出: ${results.summary.duplicateRuns}`);
  
  if (results.summary.crossDayUploads < 2) {
    throw new Error(`样例数据应该至少检测到2个跨日补传`);
  }
  
  if (results.summary.levelChanges < 2) {
    throw new Error(`样例数据应该至少检测到2个等级变更`);
  }
  
  if (results.summary.duplicateRuns < 1) {
    throw new Error(`样例数据应该至少检测到1个可复跑输出`);
  }
  
  if (results.summary.formatErrors < 6) {
    throw new Error(`样例数据应该至少检测到6个格式错误`);
  }
}

async function testDuplicateExecution() {
  const sampleFile = path.join(__dirname, '..', 'data', 'sample.csv');
  const auditor = new MealCouponAuditor(RULES_PATH);
  
  const results1 = await auditor.auditPath(sampleFile);
  console.log(`第一次稽核 - 跨日补传: ${results1.summary.crossDayUploads}`);
  
  const results2 = await auditor.auditPath(sampleFile);
  console.log(`第二次稽核 - 跨日补传: ${results2.summary.crossDayUploads}`);
  
  if (results1.summary.crossDayUploads !== results2.summary.crossDayUploads) {
    throw new Error('重复执行应该返回相同结果');
  }
  
  console.log('重复执行结果一致，验证通过');
}

async function testLineNumberPreservation() {
  const sampleFile = path.join(__dirname, '..', 'data', 'sample.csv');
  const auditor = new MealCouponAuditor(RULES_PATH);
  const results = await auditor.auditPath(sampleFile);
  
  const hasLineNumbers = results.details.formatErrors.every(e => e.lineNumber && e.filename);
  
  if (!hasLineNumbers) {
    throw new Error('所有异常记录应该保留行号和文件名');
  }
  
  console.log('异常记录都保留了行号和文件名:', results.details.formatErrors.slice(0, 2).map(e => `行${e.lineNumber} [${e.filename}]`));
}

async function testDetailedReport() {
  const sampleFile = path.join(__dirname, '..', 'data', 'sample.csv');
  const auditor = new MealCouponAuditor(RULES_PATH);
  const results = await auditor.auditPath(sampleFile);
  
  const { reportPath, summaryPath } = auditor.generateReport(results, path.join(__dirname, '..', 'output'));
  
  if (!fs.existsSync(reportPath) || !fs.existsSync(summaryPath)) {
    throw new Error('报告文件未生成');
  }
  
  console.log(`详细报告已生成: ${reportPath}`);
  console.log(`摘要报告已生成: ${summaryPath}`);
}

async function main() {
  console.log('=======================================');
  console.log('  公益助餐点助餐券核销稽核 - 测试套件');
  console.log('=======================================');
  
  const tests = [
    ['空目录稽核', testEmptyDirectory],
    ['坏行数据检测', testBadRows],
    ['样例数据完整稽核', testSampleData],
    ['重复执行一致性', testDuplicateExecution],
    ['行号和文件名保留', testLineNumberPreservation],
    ['详细报告生成', testDetailedReport]
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const [name, func] of tests) {
    const success = await runTest(name, func);
    if (success) {
      passed++;
    } else {
      failed++;
    }
  }
  
  console.log('\n=======================================');
  console.log('  测试结果汇总');
  console.log('=======================================');
  console.log(`通过: ${passed}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${tests.length}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
