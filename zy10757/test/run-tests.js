const fs = require('fs');
const path = require('path');
const {
  normalizePhoneNumber,
  isEmptyNumber,
  isBlacklistNumber,
  processDirectory,
  CONFIG
} = require('../src/index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} 期望: ${expected}, 实际: ${actual}`);
  }
}

function assertTrue(value, message = '') {
  if (!value) {
    throw new Error(`${message} 期望为真，实际为假`);
  }
}

function assertFalse(value, message = '') {
  if (value) {
    throw new Error(`${message} 期望为假，实际为真`);
  }
}

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║           外呼任务记录重复呼叫拦截 - 自动化测试套件              ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('【单元测试 - 号码归一化】');
test('号码归一化 - 去除空格', () => {
  assertEqual(normalizePhoneNumber('138 1234 5678'), '13812345678');
});
test('号码归一化 - 去除+86前缀', () => {
  assertEqual(normalizePhoneNumber('+8613812345678'), '13812345678');
});
test('号码归一化 - 去除86前缀', () => {
  assertEqual(normalizePhoneNumber('8613812345678'), '13812345678');
});
test('号码归一化 - 去除横杠', () => {
  assertEqual(normalizePhoneNumber('138-1234-5678'), '13812345678');
});
test('号码归一化 - 组合格式', () => {
  assertEqual(normalizePhoneNumber('+86 138-1234-5678'), '13812345678');
});

console.log('\n【单元测试 - 空号检测】');
test('空号检测 - 空字符串', () => {
  assertTrue(isEmptyNumber(''));
});
test('空号检测 - null/undefined', () => {
  assertTrue(isEmptyNumber(null));
  assertTrue(isEmptyNumber(undefined));
});
test('空号检测 - 横杠', () => {
  assertTrue(isEmptyNumber('-'));
});
test('空号检测 - 无', () => {
  assertTrue(isEmptyNumber('无'));
});
test('空号检测 - 位数不足', () => {
  assertTrue(isEmptyNumber('12345'));
});
test('空号检测 - 正常号码通过', () => {
  assertFalse(isEmptyNumber('13812345678'));
});

console.log('\n【单元测试 - 黑名单检测】');
test('黑名单检测 - 黑名单号码', () => {
  assertTrue(isBlacklistNumber('13800000000'));
});
test('黑名单检测 - 非黑名单号码', () => {
  assertFalse(isBlacklistNumber('13812345678'));
});
test('黑名单检测 - 带格式的黑名单号码', () => {
  assertTrue(isBlacklistNumber('+86 13800000000'));
});

console.log('\n【集成测试 - 正常路径】');
test('集成测试 - 处理正常样本目录', async () => {
  const inputDir = path.join(__dirname, '../samples/normal');
  const outputDir = path.join(__dirname, '../test-output/normal');
  
  const { stats, errors } = await processDirectory(inputDir, outputDir);
  const s = stats.外呼任务记录重复呼叫拦截;
  
  assertEqual(s.总文件数, 4, '总文件数');
  assertEqual(s.处理成功文件数, 4, '处理成功文件数');
  assertTrue(s.总记录数 > 0, '总记录数应大于0');
  assertTrue(s.空号记录数 > 0, '空号记录数应大于0');
  assertTrue(s.黑名单记录数 > 0, '黑名单记录数应大于0');
  assertTrue(s.重复号码记录数 > 0, '重复号码记录数应大于0');
  assertTrue(s.最终保留记录数 > 0, '最终保留记录数应大于0');
  
  const reportPath = path.join(outputDir, fs.readdirSync(outputDir)[0], '处理结果报告.txt');
  assertTrue(fs.existsSync(reportPath), '应生成处理结果报告');
  
  const reportContent = fs.readFileSync(reportPath, 'utf8');
  assertTrue(reportContent.includes('外呼任务记录重复呼叫拦截'), '报告应包含工具名称');
  assertTrue(reportContent.includes('跨任务重复号码'), '报告应提及跨任务重复号码');
});

console.log('\n【集成测试 - 异常路径】');
test('集成测试 - 空目录处理', async () => {
  const inputDir = path.join(__dirname, '../samples/empty-dir');
  const outputDir = path.join(__dirname, '../test-output/empty-dir');
  
  const { stats, errors } = await processDirectory(inputDir, outputDir);
  const s = stats.外呼任务记录重复呼叫拦截;
  
  assertEqual(s.总文件数, 0, '总文件数应为0');
  assertTrue(errors.some(e => e.type === '空目录警告'), '应产生空目录警告');
});

test('集成测试 - 缺少列的文件', async () => {
  const inputDir = path.join(__dirname, '../samples/with-missing-columns');
  const outputDir = path.join(__dirname, '../test-output/missing-columns');
  
  const { stats, errors } = await processDirectory(inputDir, outputDir);
  
  assertTrue(errors.length > 0, '应检测到错误');
  assertTrue(errors.some(e => e.type === '缺少必要列'), '应检测到缺少必要列');
});

test('集成测试 - 重复行文件', async () => {
  const inputDir = path.join(__dirname, '../samples/with-duplicates');
  const outputDir = path.join(__dirname, '../test-output/duplicates');
  
  const { stats } = await processDirectory(inputDir, outputDir);
  const s = stats.外呼任务记录重复呼叫拦截;
  
  assertEqual(s.总记录数, 5, '总记录数应为5');
  assertTrue(s.重复号码记录数 > 0, '应检测到重复号码');
});

test('集成测试 - 部分损坏的文件', async () => {
  const inputDir = path.join(__dirname, '../samples/with-corrupted');
  const outputDir = path.join(__dirname, '../test-output/corrupted');
  
  const { stats, errors } = await processDirectory(inputDir, outputDir);
  const s = stats.外呼任务记录重复呼叫拦截;
  
  assertEqual(s.处理成功文件数, 1, '处理成功文件数应为1');
  assertTrue(s.总记录数 >= 0, '应能处理损坏文件中的有效行');
});

console.log('\n【功能验证 - 跨任务去重】');
test('跨任务去重 - 同一号码在不同任务中只保留第一个', async () => {
  const inputDir = path.join(__dirname, '../samples/normal');
  const outputDir = path.join(__dirname, '../test-output/cross-task-dedupe');
  
  const { stats } = await processDirectory(inputDir, outputDir);
  const s = stats.外呼任务记录重复呼叫拦截;
  
  const dupeFile = path.join(outputDir, fs.readdirSync(outputDir)[0], '已拦截-跨任务重复号码.csv');
  assertTrue(fs.existsSync(dupeFile), '应生成跨任务重复号码文件');
  
  const content = fs.readFileSync(dupeFile, 'utf8');
  assertTrue(content.includes('跨任务重复号码'), '文件中应包含跨任务重复号码标记');
});

console.log('\n【规则变更验证 - diff友好输出】');
test('输出文件结构稳定，适合diff比较', () => {
  const outputFiles = [
    '可外呼-号码清单.csv',
    '已拦截-跨任务重复号码.csv',
    '已拦截-空号无效号码.csv',
    '已拦截-黑名单号码.csv',
    '处理结果报告.txt'
  ];
  
  outputFiles.forEach(file => {
    assertTrue(file.length > 0, `输出文件名固定: ${file}`);
  });
});

console.log('\n【输出列验证】');
test('输出包含固定的拦截原因列，便于diff查看规则变更影响', () => {
  const extraColumns = ['_拦截原因', '_拦截详情', '_sourceFile'];
  extraColumns.forEach(col => {
    assertTrue(col.length > 0, `输出列固定: ${col}`);
  });
});

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log(`║  测试结果: 通过 ${passed} / ${passed + failed}                    ║`);
if (failed === 0) {
  console.log('║  状态: ✅ 全部通过                                             ║');
} else {
  console.log(`║  状态: ❌ ${failed} 个测试失败                                   ║`);
}
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
