const fs = require('fs');
const path = require('path');
const DataStore = require('./src/dataStore');
const Scheduler = require('./src/scheduler');

const testDataDir = './test_data';
const store = new DataStore(testDataDir);
const scheduler = new Scheduler(store);

console.log('='.repeat(80));
console.log('商场广告位排期 CLI - 测试脚本');
console.log('='.repeat(80));

function runTest(testName, testFn) {
  console.log(`\n【测试】${testName}`);
  try {
    testFn();
    console.log(`  ✓ 通过`);
    return true;
  } catch (error) {
    console.log(`  ✗ 失败: ${error.message}`);
    console.log(`    堆栈: ${error.stack}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: 期望 ${expected}, 实际 ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

store.clearAll();

const screens = JSON.parse(fs.readFileSync('./samples/screens.json', 'utf8'));
for (const screen of screens) {
  store.addScreen(screen);
}
console.log('\n已导入测试屏幕档案');

const tests = [];

tests.push(runTest('1. 普通合同导入 - 成功', () => {
  const contract = JSON.parse(fs.readFileSync('./samples/contract_normal.json', 'utf8'));
  const result = scheduler.importContract(contract);
  assertTrue(result.success, '合同应该导入成功');
  assertEqual(result.contractId, 'CONTRACT-001', '合同ID应该正确');
  assertEqual(result.placementsAdded, 5, '应该添加5个投放时段');
}));

tests.push(runTest('2. 重复导入同一合同 - 应该失败', () => {
  const contract = JSON.parse(fs.readFileSync('./samples/contract_normal.json', 'utf8'));
  const result = scheduler.importContract(contract);
  assertFalse(result.success, '重复导入应该失败');
  assertTrue(result.errors.some(e => e.includes('已存在')), '错误信息应该包含"已存在"');
}));

tests.push(runTest('3. 时间冲突合同导入 - 应该失败', () => {
  const contract = JSON.parse(fs.readFileSync('./samples/contract_conflict.json', 'utf8'));
  const result = scheduler.importContract(contract);
  assertFalse(result.success, '时间冲突应该导入失败');
  assertTrue(result.errors.some(e => e.includes('冲突')), '错误信息应该包含"冲突"');
}));

tests.push(runTest('4. 正常赠送时段 - 应该成功', () => {
  const gift = JSON.parse(fs.readFileSync('./samples/gift_normal.json', 'utf8'));
  const result = scheduler.addGift(gift);
  assertTrue(result.success, '正常赠送应该成功');
}));

tests.push(runTest('5. 赠送天数超过限制 - 应该失败', () => {
  const gift = JSON.parse(fs.readFileSync('./samples/gift_exceed_limit.json', 'utf8'));
  const result = scheduler.addGift(gift);
  assertFalse(result.success, '超过限制应该失败');
  assertTrue(result.errors.some(e => e.includes('超过合同限制')), '错误信息应该包含"超过合同限制"');
}));

tests.push(runTest('6. 换刊申请有素材 - 应该成功', () => {
  const change = JSON.parse(fs.readFileSync('./samples/change_with_material.json', 'utf8'));
  const result = scheduler.processChange(change);
  assertTrue(result.success, '有素材的换刊应该成功');
}));

tests.push(runTest('7. 换刊申请无素材 - 应该失败', () => {
  const change = JSON.parse(fs.readFileSync('./samples/change_no_material.json', 'utf8'));
  const result = scheduler.processChange(change);
  assertFalse(result.success, '无素材的换刊应该失败');
  assertTrue(result.errors.some(e => e.includes('必须提供新素材')), '错误信息应该包含素材相关提示');
}));

tests.push(runTest('8. 生成排期预览 - 应该包含正确信息', () => {
  const schedule = scheduler.generateSchedule('2026-05-10', '2026-05-16');
  
  assertTrue(schedule['SCREEN-001'], '应该包含SCREEN-001');
  assertTrue(schedule['SCREEN-001'].dailySchedule['2026-05-10'], '应该包含5月10日的排期');
  
  const may10Placements = schedule['SCREEN-001'].dailySchedule['2026-05-10'].placements;
  assertTrue(may10Placements.length > 0, '5月10日应该有投放');
  assertEqual(may10Placements[0].client, '星巴克咖啡', '客户应该是星巴克咖啡');
}));

tests.push(runTest('9. 排期预览显示待处理原因 - 缺少素材', () => {
  const schedule = scheduler.generateSchedule('2026-05-11', '2026-05-11');
  const may11 = schedule['SCREEN-001'].dailySchedule['2026-05-11'];
  
  assertTrue(may11.placements.length > 0, '5月11日应该有投放');
  
  const hasWaiting = may11.placements.some(p => 
    p.status === 'waiting-approval' && 
    p.pendingReasons.some(r => r.includes('等待审批'))
  );
  assertTrue(hasWaiting, '应该显示等待审批的状态');
}));

tests.push(runTest('10. 确认发布 - 应该更新换刊状态', () => {
  const published = scheduler.confirmPublish();
  
  assertTrue(published.publishDate, '应该有发布时间');
  assertTrue(published.changes.some(c => c.status === 'published'), '应该有已发布的换刊');
}));

console.log('\n' + '='.repeat(80));
const passed = tests.filter(t => t).length;
const failed = tests.length - passed;
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
