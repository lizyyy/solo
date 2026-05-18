const fs = require('fs');
const path = require('path');
const LaundryLabelReprint = require('./index');

const testOutputDir = './test-output';

function cleanTestOutput() {
  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testOutputDir, { recursive: true });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`❌ 测试失败: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTest(name, testFn) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`测试: ${name}`);
  console.log(`${'='.repeat(60)}`);
  try {
    await testFn();
    console.log(`\n✅ ${name} - 全部通过!`);
    return true;
  } catch (error) {
    console.error(`\n❌ ${name} - 失败: ${error.message}`);
    return false;
  }
}

async function testNormalData() {
  const app = new LaundryLabelReprint('./samples/洗衣店正常数据.csv', testOutputDir);
  const result = await app.process();
  
  assert(result.success, '处理成功');
  assert(result.errors.length === 0, '没有错误');
  assert(result.warnings.length === 0, '没有警告');
  assert(app.results.length === 5, '正确读取5条记录');
  assert(app.duplicateScans.length === 0, '没有重复扫码');
  assert(app.cancelledOrders.length === 0, '没有撤单');
}

async function testMissingColumns() {
  const app = new LaundryLabelReprint('./samples/洗衣店缺列.csv', testOutputDir);
  const result = await app.process();
  
  assert(result.errors.length > 0, '检测到缺列错误');
  const missingColError = result.errors.find(e => e.type === '缺列');
  assert(missingColError, '错误类型为"缺列"');
  assert(missingColError.row === 1, '行号正确为第1行');
  assert(missingColError.file.includes('洗衣店缺列.csv'), '来源文件正确');
}

async function testDuplicateScans() {
  const app = new LaundryLabelReprint('./samples/洗衣店重复扫码.csv', testOutputDir);
  const result = await app.process();
  
  assert(result.success, '处理成功');
  assert(app.duplicateScans.length === 2, '检测到2次重复扫码');
  assert(app.warnings.length === 2, '生成2条警告');
  
  const scan1 = app.duplicateScans.find(d => d['衣物编号'] === 'SH00123');
  assert(scan1, '检测到SH00123重复扫码');
  assert(scan1.rows.length === 2, '涉及两行数据');
  assert(scan1.type === '同件衣物多次扫码', '异常类型正确');
  assert(scan1.file.includes('洗衣店重复扫码.csv'), '来源文件正确');
}

async function testCancelledOrders() {
  const app = new LaundryLabelReprint('./samples/洗衣店含撤单.csv', testOutputDir);
  const result = await app.process();
  
  assert(result.success, '处理成功');
  assert(app.cancelledOrders.length === 2, '检测到2条撤单');
  assert(app.warnings.length === 2, '生成2条警告');
  
  const cancelled = app.cancelledOrders.find(c => c['衣物编号'] === 'SH00125');
  assert(cancelled, '检测到SH00125撤单');
  assert(cancelled.type === '撤单', '异常类型正确');
  assert(cancelled.row > 0, '包含行号信息');
  assert(cancelled.file.includes('洗衣店含撤单.csv'), '来源文件正确');
}

async function testPartialFailures() {
  const app = new LaundryLabelReprint('./samples/洗衣店综合异常.csv', testOutputDir);
  const result = await app.process();
  
  assert(app.rowNumber === 7, '读取7行原始数据');
  assert(app.duplicateScans.length === 1, '检测到1次重复扫码');
  assert(app.cancelledOrders.length === 1, '检测到1条撤单');
  assert(app.errors.length > 0, '检测到数据错误');
  
  const emptyColError = result.errors.find(e => e.message.includes('列值为空'));
  assert(emptyColError, '检测到空列值错误');
  assert(emptyColError.row === 5, '空列值在第5行');
  
  const dateError = result.errors.find(e => e.message.includes('日期格式错误'));
  assert(dateError, '检测到日期格式错误');
  assert(dateError.row === 6, '日期错误在第6行');
  
  const statusError = result.errors.find(e => e.message.includes('无效状态'));
  assert(statusError, '检测到无效状态错误');
  assert(statusError.row === 8, '状态错误在第8行');
  
  assert(app.warnings.length === 2, '共有2条警告');
}

async function testRerunableOutput() {
  cleanTestOutput();
  
  const app1 = new LaundryLabelReprint('./samples/洗衣店正常数据.csv', testOutputDir);
  await app1.process();
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const app2 = new LaundryLabelReprint('./samples/洗衣店正常数据.csv', testOutputDir);
  await app2.process();
  
  const files = fs.readdirSync(testOutputDir);
  const csvFiles = files.filter(f => f.endsWith('.csv'));
  
  assert(csvFiles.length >= 4, '两次运行生成至少4个文件');
  
  const reprintFiles = files.filter(f => f.includes('补打标签'));
  assert(reprintFiles.length === 2, '生成2个不同时间戳的补打文件');
  
  const filenames = new Set(files);
  assert(filenames.size === files.length, '所有输出文件名唯一');
}

async function testExceptionSummaryHasFileInfo() {
  const app = new LaundryLabelReprint('./samples/洗衣店综合异常.csv', testOutputDir);
  await app.process();
  
  const files = fs.readdirSync(testOutputDir);
  const summaryFile = files.find(f => f.includes('综合异常') && f.includes('异常摘要'));
  assert(summaryFile, '生成异常摘要文件');
  
  const summaryContent = fs.readFileSync(path.join(testOutputDir, summaryFile), 'utf8');
  assert(summaryContent.includes('洗衣店综合异常.csv'), '摘要包含来源文件名');
  assert(summaryContent.includes('行号'), '摘要包含行号列');
  assert(summaryContent.includes('异常类型'), '摘要包含异常类型列');
}

async function testNonExistentFile() {
  const app = new LaundryLabelReprint('./samples/不存在的文件.csv', testOutputDir);
  const result = await app.process();
  assert(result.success === false, '文件不存在时处理失败');
  assert(result.errors.length > 0, '返回错误信息');
}

async function main() {
  console.log('\n' + '█'.repeat(60));
  console.log('█  连锁洗衣店洗衣标签补打 CLI - 测试套件');
  console.log('█'.repeat(60));

  cleanTestOutput();

  const results = [];
  
  results.push(await runTest('正常数据处理', testNormalData));
  results.push(await runTest('缺列检测', testMissingColumns));
  results.push(await runTest('重复扫码检测', testDuplicateScans));
  results.push(await runTest('撤单检测', testCancelledOrders));
  results.push(await runTest('部分失败场景', testPartialFailures));
  results.push(await runTest('可复跑输出', testRerunableOutput));
  results.push(await runTest('异常摘要包含文件和行号', testExceptionSummaryHasFileInfo));
  results.push(await runTest('文件不存在处理', testNonExistentFile));

  const passed = results.filter(r => r).length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log(`测试结果: ${passed}/${total} 通过`);
  console.log('='.repeat(60));
  
  if (passed === total) {
    console.log('\n🎉 所有测试通过!');
    console.log('\n输出文件说明:');
    console.log('  - test.js: 测试套件');
    console.log('  - index.js: CLI主程序');
    console.log('  - package.json: 项目配置');
    console.log('  - samples/: 洗衣店业务样例数据目录');
    console.log('    - 洗衣店正常数据.csv: 正常数据');
    console.log('    - 洗衣店缺列.csv: 缺列异常数据');
    console.log('    - 洗衣店重复扫码.csv: 同件衣物多次扫码数据');
    console.log('    - 洗衣店含撤单.csv: 含撤单数据');
    console.log('    - 洗衣店综合异常.csv: 综合异常数据');
    console.log('  - test-output/: 测试输出目录');
    process.exit(0);
  } else {
    console.log('\n❌ 部分测试失败!');
    process.exit(1);
  }
}

main();
