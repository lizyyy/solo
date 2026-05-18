const fs = require('fs');
const path = require('path');
const PriceComparator = require('../src/comparator');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✅ PASS: ${message}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${message}`);
  }
}

function loadConfig(overrides = {}) {
  const configPath = path.join(__dirname, '../config/rules.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return { ...config, ...overrides };
}

console.log('='.repeat(60));
console.log('  价目表快照门店价格生效比对 - 自动化测试');
console.log('='.repeat(60));
console.log('');

console.log('--- 测试 1: 正常匹配测试 ---');
const config1 = loadConfig();
const comparator1 = new PriceComparator(config1);
const normalData = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/normal/price_snapshot_001.json')));
const result1 = comparator1.compare(normalData);
assert(result1.totalRecords === 3, '总记录数应为3');
assert(result1.matched === 3, '匹配数应为3');
assert(result1.mismatched === 0, '不匹配数应为0');
assert(result1.matchRate === 100, '匹配率应为100%');
console.log('');

console.log('--- 测试 2: 半夜生效规则测试 ---');
const midnightData = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/normal/price_snapshot_002_midnight.json')));
const result2 = comparator1.compare(midnightData);
assert(result2.totalRecords === 2, '总记录数应为2');
assert(result2.results[0].appliedRules.includes('半夜生效'), '应包含半夜生效规则标记');
assert(result2.results[1].appliedRules.includes('半夜生效'), '应包含半夜生效规则标记');
console.log('');

console.log('--- 测试 3: 门店停业规则测试 ---');
const closedData = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/normal/price_snapshot_003_closed.json')));
const result3 = comparator1.compare(closedData);
assert(result3.totalRecords === 2, '总记录数应为2');
assert(result3.matched === 2, '停业门店即使价格不同也应视为匹配');
assert(result3.results[0].appliedRules.includes('门店停业'), '应包含门店停业规则标记');
assert(result3.results[0].details['门店停业'] === '门店停业期间价格不校验', '应有详细说明');
console.log('');

console.log('--- 测试 4: 旧订单规则测试 ---');
const oldOrderData = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/normal/price_snapshot_004_oldorder.json')));
const result4 = comparator1.compare(oldOrderData);
assert(result4.totalRecords === 2, '总记录数应为2');
assert(result4.results[0].appliedRules.includes('旧订单'), '应包含旧订单规则标记');
assert(result4.results[0].details['旧订单'] === '历史订单使用下单时价格版本', '应有详细说明');
console.log('');

console.log('--- 测试 5: 坏行/格式错误测试 ---');
const badData = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/bad/bad_rows_001.json')));
const result5 = comparator1.compare(badData);
assert(result5.totalRecords === 3, '总记录数应为3');
assert(result5.mismatched > 0, '应有不匹配记录');
const hasFormatError = result5.results.some(r => r.mismatchType === '价格格式错误');
assert(hasFormatError, '应检测到价格格式错误');
const hasMismatch = result5.results.some(r => r.mismatchType === '价格不匹配');
assert(hasMismatch, '应检测到价格不匹配');
console.log('');

console.log('--- 测试 6: 规则禁用测试 - 半夜生效 ---');
const configNoMidnight = loadConfig();
configNoMidnight.rules.midnightEffective.enabled = false;
const comparatorNoMidnight = new PriceComparator(configNoMidnight);
const result6 = comparatorNoMidnight.compare(midnightData);
const hasMidnightRule = result6.results.some(r => r.appliedRules.includes('半夜生效'));
assert(!hasMidnightRule, '禁用后不应应用半夜生效规则');
console.log('');

console.log('--- 测试 7: 规则禁用测试 - 门店停业 ---');
const configNoClosed = loadConfig();
configNoClosed.rules.storeClosed.enabled = false;
const comparatorNoClosed = new PriceComparator(configNoClosed);
const result7 = comparatorNoClosed.compare(closedData);
const hasClosedRule = result7.results.some(r => r.appliedRules.includes('门店停业'));
assert(!hasClosedRule, '禁用后不应应用门店停业规则');
console.log('');

console.log('--- 测试 8: 汇总统计测试 ---');
const allFiles = [
  { sourceFile: '1.json', ...result1 },
  { sourceFile: '2.json', ...result2 }
];
const summary = comparator1.generateSummary(allFiles);
assert(summary.totalRecords === 5, '汇总总记录数应为5');
assert(summary.matched === 5, '汇总匹配数应为5');
assert(typeof summary.breakdown === 'object', '应有breakdown统计');
console.log('');

console.log('--- 测试 9: 输出包含业务标识 ---');
assert(result1.results[0].storeName === '北京朝阳门店', '应包含门店名称');
assert(result1.results[0].itemName === '经典美式咖啡', '应包含商品名称');
assert(result1.results[0].storeId === 'ST001', '应包含门店编号');
assert(result1.results[0].priceVersion === 'V202605', '应包含价格版本');
console.log('');

console.log('--- 测试 10: 价格容差测试 ---');
const configTolerance = loadConfig();
configTolerance.rules.priceMatch.tolerance = 1.0;
const comparatorTolerance = new PriceComparator(configTolerance);
const toleranceData = [{
  storeId: 'ST001',
  storeName: '测试门店',
  itemId: 'ITEM001',
  itemName: '测试商品',
  actualPrice: 28.5,
  expectedPrice: 28.0,
  snapshotTime: '2026-05-18T08:30:00',
  priceVersion: 'V1',
  storeStatus: 'OPEN',
  orderDate: '2026-05-18T08:25:00',
  versionEffectiveDate: '2026-05-15T00:00:00'
}];
const result10 = comparatorTolerance.compare(toleranceData);
assert(result10.matched === 1, '容差内的价格差异应视为匹配');
console.log('');

console.log('='.repeat(60));
console.log('  测试结果汇总');
console.log('='.repeat(60));
console.log(`通过: ${passed}`);
console.log(`失败: ${failed}`);
console.log(`总计: ${passed + failed}`);
console.log('');

if (failed > 0) {
  console.log('❌ 部分测试失败，请检查代码');
  process.exit(1);
} else {
  console.log('✅ 所有测试通过！');
  process.exit(0);
}
