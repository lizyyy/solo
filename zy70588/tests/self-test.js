const fs = require('fs');
const path = require('path');
const { parseSampleRate, detectErrorTypes, extractGroupFields, parseLogFile } = require('../src/parser');
const { calculateConfidenceInterval, detectAnomalies, aggregateGroups } = require('../src/statistics');
const { saveJsonOutput, generateHtmlReport } = require('../src/reporter');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

console.log('='.repeat(60));
console.log('📦 模块 1: 采样率解析 (parser.js)');
console.log('='.repeat(60));

test('解析小数格式采样率 0.1', () => {
  const rate = parseSampleRate(0.1);
  assert(rate === 0.1, `期望 0.1，实际 ${rate}`);
});

test('解析字符串格式采样率 "0.05"', () => {
  const rate = parseSampleRate('0.05');
  assert(rate === 0.05, `期望 0.05，实际 ${rate}`);
});

test('解析百分比格式 "10%"', () => {
  const rate = parseSampleRate('10%');
  assert(rate === 0.1, `期望 0.1，实际 ${rate}`);
});

test('解析百分比格式 "50%"', () => {
  const rate = parseSampleRate('50%');
  assert(rate === 0.5, `期望 0.5，实际 ${rate}`);
});

test('无效采样率抛出错误 (0)', () => {
  let threw = false;
  try { parseSampleRate(0); } catch (e) { threw = true; }
  assert(threw, '应该抛出错误');
});

test('无效采样率抛出错误 (1.5)', () => {
  let threw = false;
  try { parseSampleRate(1.5); } catch (e) { threw = true; }
  assert(threw, '应该抛出错误');
});

test('无效采样率抛出错误 (150%)', () => {
  let threw = false;
  try { parseSampleRate('150%'); } catch (e) { threw = true; }
  assert(threw, '应该抛出错误');
});

test('100%采样率应该有效', () => {
  const rate = parseSampleRate('100%');
  assert(rate === 1, `期望 1，实际 ${rate}`);
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 2: 错误类型检测 (parser.js)');
console.log('='.repeat(60));

test('检测 ERROR 日志', () => {
  const types = detectErrorTypes('2024-01-01 [ERROR] 数据库连接失败');
  assert(types.includes('ERROR'), '应该包含 ERROR');
});

test('检测 FATAL 日志', () => {
  const types = detectErrorTypes('2024-01-01 [FATAL] 系统崩溃');
  assert(types.includes('FATAL'), '应该包含 FATAL');
});

test('检测 EXCEPTION 日志', () => {
  const types = detectErrorTypes('NullReferenceException at System.Core');
  assert(types.includes('EXCEPTION'), '应该包含 EXCEPTION');
});

test('检测 HTTP_500 错误', () => {
  const types = detectErrorTypes('GET /api 500 123ms');
  assert(types.includes('HTTP_5XX'), '应该包含 HTTP_5XX');
});

test('检测 WARN 日志', () => {
  const types = detectErrorTypes('[WARNING] 内存使用过高');
  assert(types.includes('WARN'), '应该包含 WARN');
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 3: 分组字段提取 (parser.js)');
console.log('='.repeat(60));

test('提取 service 字段', () => {
  const groups = extractGroupFields('service=user-api - 错误', ['service']);
  assert(groups.service === 'user-api', `期望 user-api，实际 ${groups.service}`);
});

test('提取 error_type 字段', () => {
  const groups = extractGroupFields('[ERROR] service=order - 错误', ['error_type']);
  assert(groups.error_type === 'ERROR', `期望 ERROR，实际 ${groups.error_type}`);
});

test('提取多个字段', () => {
  const groups = extractGroupFields('[ERROR] service=payment - 错误', ['service', 'error_type']);
  assert(groups.service === 'payment', 'service 字段错误');
  assert(groups.error_type === 'ERROR', 'error_type 字段错误');
});

test('未知字段返回 unknown', () => {
  const groups = extractGroupFields('普通日志行', ['not_exist_field']);
  assert(groups.not_exist_field === 'unknown', '应该返回 unknown');
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 4: 置信区间计算 (statistics.js)');
console.log('='.repeat(60));

test('置信区间 - 样本数 100，采样率 0.1', () => {
  const ci = calculateConfidenceInterval(100, 0.1);
  assert(ci.estimated === 1000, `期望估算值 1000，实际 ${ci.estimated}`);
  assert(typeof ci.lowerBound === 'number', 'lowerBound 应该是数字');
  assert(typeof ci.upperBound === 'number', 'upperBound 应该是数字');
  assert(ci.lowerBound <= ci.estimated && ci.estimated <= ci.upperBound, '置信区间应该包含估算值');
});

test('置信区间 - 不同置信水平', () => {
  const ci95 = calculateConfidenceInterval(100, 0.1, 0.95);
  const ci99 = calculateConfidenceInterval(100, 0.1, 0.99);
  assert(ci99.marginOfError >= ci95.marginOfError, '99%置信区间应该更宽');
});

test('0样本置信区间不应该有NaN', () => {
  const ci = calculateConfidenceInterval(0, 0.1);
  assert(ci.estimated === 0, `期望估算值 0，实际 ${ci.estimated}`);
  assert(!isNaN(ci.lowerBound), 'lowerBound 不应该是 NaN');
  assert(!isNaN(ci.upperBound), 'upperBound 不应该是 NaN');
  assert(ci.lowerBound === 0, `期望下限 0，实际 ${ci.lowerBound}`);
  assert(ci.upperBound === 0, `期望上限 0，实际 ${ci.upperBound}`);
});

test('1样本置信区间应该有合理边界', () => {
  const ci = calculateConfidenceInterval(1, 0.1);
  assert(ci.estimated === 10, `期望估算值 10，实际 ${ci.estimated}`);
  assert(!isNaN(ci.lowerBound), 'lowerBound 不应该是 NaN');
  assert(!isNaN(ci.upperBound), 'upperBound 不应该是 NaN');
  assert(ci.lowerBound === 0, `期望下限 0，实际 ${ci.lowerBound}`);
  assert(ci.upperBound === 30, `期望上限 30，实际 ${ci.upperBound}`);
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 5: 异常样本检测 (statistics.js)');
console.log('='.repeat(60));

test('检测小样本异常', () => {
  const groups = {
    'group1': { sampleCount: 3, groups: {} },
    'group2': { sampleCount: 50, groups: {} },
    'group3': { sampleCount: 60, groups: {} }
  };
  const anomalies = detectAnomalies(groups, 0.1);
  assert(anomalies.length >= 1, '应该检测到小样本异常');
  assert(anomalies[0].sampleCount === 3, '应该标记样本数为3的组');
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 6: 完整日志文件解析 (parser.js)');
console.log('='.repeat(60));

const testLogPath = path.join(__dirname, 'sample-logs.txt');

test('解析测试日志文件', async () => {
  const results = await parseLogFile(testLogPath, {
    sampleRate: 0.1,
    groupFields: ['service', 'error_type']
  });
  assert(results.totalLines > 0, '应该解析到多行');
  assert(results.validLines > 0, '应该有有效行');
  assert(Object.keys(results.groups).length > 0, '应该有分组');
});

test('识别坏行（空行和注释）', async () => {
  const results = await parseLogFile(testLogPath, { sampleRate: 0.1, groupFields: ['service'] });
  assert(results.badLines.length > 0, '应该检测到坏行');
  const hasEmpty = results.badLines.some(b => b.reason === '空行');
  const hasComment = results.badLines.some(b => b.reason === '注释行');
  assert(hasEmpty, '应该检测到空行');
  assert(hasComment, '应该检测到注释行');
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 7: 分组聚合统计 (statistics.js)');
console.log('='.repeat(60));

test('聚合统计结果', async () => {
  const parseResults = await parseLogFile(testLogPath, {
    sampleRate: 0.1,
    groupFields: ['service', 'error_type']
  });
  const aggregated = aggregateGroups(parseResults, 0.95);
  
  assert(aggregated.summary, '应该有 summary');
  assert(aggregated.groups.length > 0, '应该有分组统计');
  assert(Array.isArray(aggregated.anomalies), 'anomalies 应该是数组');
  assert(Array.isArray(aggregated.badLines), 'badLines 应该是数组');
  assert(aggregated.summary.totalEstimatedErrors > 0, '应该有估算错误数');
});

console.log('\n' + '='.repeat(60));
console.log('📦 模块 8: 报告导出 (reporter.js)');
console.log('='.repeat(60));

const testOutputPath = path.join(__dirname, 'test-output');

test('导出 JSON 报告', async () => {
  const parseResults = await parseLogFile(testLogPath, { sampleRate: 0.1, groupFields: ['service'] });
  const aggregated = aggregateGroups(parseResults, 0.95);
  const jsonPath = `${testOutputPath}.json`;
  const resultPath = saveJsonOutput(aggregated, jsonPath);
  
  assert(fs.existsSync(resultPath), 'JSON 文件应该存在');
  const content = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));
  assert(content.summary, 'JSON 应该包含 summary');
  assert(content.groups, 'JSON 应该包含 groups');
});

test('导出 HTML 报告', async () => {
  const parseResults = await parseLogFile(testLogPath, { sampleRate: 0.1, groupFields: ['service'] });
  const aggregated = aggregateGroups(parseResults, 0.95);
  const htmlPath = `${testOutputPath}.html`;
  const resultPath = generateHtmlReport(aggregated, htmlPath);
  
  assert(fs.existsSync(resultPath), 'HTML 文件应该存在');
  const content = fs.readFileSync(resultPath, 'utf-8');
  assert(content.includes('<!DOCTYPE html>'), '应该是有效的 HTML');
  assert(content.includes('日志采样还原分析报告'), '应该包含报告标题');
});

console.log('\n' + '='.repeat(60));
console.log('📊 自检结果');
console.log('='.repeat(60));
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 所有测试通过！');
  console.log('\n📝 可以运行以下命令体验完整功能:');
  console.log('  npm run demo        - 运行演示');
  console.log('  node src/cli.js --help  - 查看帮助');
} else {
  console.log('\n⚠️  有测试失败，请检查代码');
  process.exit(1);
}
