const DataStore = require('../src/models/data-store');
const LockService = require('../src/services/lock-service');
const RepairService = require('../src/services/repair-service');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  错误: ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: 期望 ${expected}，实际 ${actual}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

console.log('\n开始运行测试...\n');

console.log('--- 房源和门锁测试 ---');

test('创建房源', () => {
  const property = DataStore.addProperty({
    name: '测试房源1',
    address: '测试地址1'
  });
  assertTrue(property.id, '房源ID应该存在');
  assertEqual(property.name, '测试房源1', '房源名称');
});

test('为房源创建门锁', () => {
  const property = DataStore.addProperty({
    name: '测试房源2',
    address: '测试地址2'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁',
    model: 'Test-Model'
  });
  assertTrue(lock.id, '门锁ID应该存在');
  assertEqual(lock.batteryLevel, 100, '初始电量应该是100%');
  assertEqual(lock.status, 'normal', '初始状态应该正常');
});

test('更新门锁电量到低电状态', () => {
  const property = DataStore.addProperty({
    name: '测试房源3',
    address: '测试地址3'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁2',
    model: 'Test-Model-2'
  });
  const updatedLock = LockService.updateBatteryLevel(lock.id, 15);
  assertEqual(updatedLock.status, 'low_battery', '状态应为low_battery');
});

console.log('\n--- 告警测试 ---');

test('低电时自动创建告警', () => {
  const property = DataStore.addProperty({
    name: '测试房源4',
    address: '测试地址4'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁3',
    model: 'Test-Model-3'
  });
  LockService.updateBatteryLevel(lock.id, 8);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  assertTrue(alerts.length === 1, '应该有一个活动告警');
  assertEqual(alerts[0].urgency, 'critical', '电量<10%应为critical');
});

test('确认告警', () => {
  const property = DataStore.addProperty({
    name: '测试房源5',
    address: '测试地址5'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁4',
    model: 'Test-Model-4'
  });
  LockService.updateBatteryLevel(lock.id, 12);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  const acknowledged = LockService.acknowledgeAlert(alerts[0].id, '测试运营');
  assertTrue(acknowledged.acknowledgedAt, '确认时间应该存在');
  assertEqual(acknowledged.acknowledgedBy, '测试运营', '确认人');
});

test('撤回告警', () => {
  const property = DataStore.addProperty({
    name: '测试房源6',
    address: '测试地址6'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁5',
    model: 'Test-Model-5'
  });
  LockService.updateBatteryLevel(lock.id, 18);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  const withdrawn = LockService.withdrawAlert(alerts[0].id, '误报', '测试运营');
  assertEqual(withdrawn.status, 'withdrawn', '状态应为withdrawn');
  assertTrue(withdrawn.resolutionReason.includes('误报'), '撤回原因');
});

console.log('\n--- 维修派单测试 ---');

test('从告警创建维修派单', () => {
  const property = DataStore.addProperty({
    name: '测试房源7',
    address: '测试地址7'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁6',
    model: 'Test-Model-6'
  });
  LockService.updateBatteryLevel(lock.id, 5);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  const order = RepairService.createFromAlert(alerts[0].id, '测试运营');
  assertTrue(order.id, '维修单ID应该存在');
  assertEqual(order.status, 'pending', '初始状态应为pending');
  assertEqual(order.type, 'battery_replacement', '类型应为battery_replacement');
});

test('完整维修流程', () => {
  const property = DataStore.addProperty({
    name: '测试房源8',
    address: '测试地址8'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁7',
    model: 'Test-Model-7'
  });
  LockService.updateBatteryLevel(lock.id, 10);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  let order = RepairService.createFromAlert(alerts[0].id, '测试运营');
  
  order = RepairService.assign(order.id, '维修师傅', '测试运营');
  assertEqual(order.status, 'assigned', '指派后状态');
  
  order = RepairService.start(order.id, '维修师傅');
  assertEqual(order.status, 'in_progress', '开始后状态');
  
  order = RepairService.complete(order.id, '更换电池', '维修师傅');
  assertEqual(order.status, 'completed', '完成后状态');
  
  const updatedLock = DataStore.getLock(lock.id);
  assertEqual(updatedLock.batteryLevel, 100, '维修后电量应为100%');
  assertEqual(updatedLock.status, 'normal', '维修后状态应为normal');
});

console.log('\n--- 状态流转保护测试 ---');

test('不能直接完成未指派的维修单', () => {
  const property = DataStore.addProperty({
    name: '测试房源9',
    address: '测试地址9'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁8',
    model: 'Test-Model-8'
  });
  LockService.updateBatteryLevel(lock.id, 8);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  const order = RepairService.createFromAlert(alerts[0].id, '测试运营');
  
  let error = null;
  try {
    RepairService.complete(order.id, '跳过流程');
  } catch (e) {
    error = e;
  }
  assertTrue(error !== null, '应该抛出异常');
});

test('不能修改已完成的维修单', () => {
  const property = DataStore.addProperty({
    name: '测试房源10',
    address: '测试地址10'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁9',
    model: 'Test-Model-9'
  });
  LockService.updateBatteryLevel(lock.id, 15);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  let order = RepairService.createFromAlert(alerts[0].id, '测试运营');
  order = RepairService.assign(order.id, '维修师傅', '测试运营');
  order = RepairService.start(order.id, '维修师傅');
  order = RepairService.complete(order.id, '完成', '维修师傅');
  
  let error = null;
  try {
    RepairService.revise(order.id, { priority: 'high' });
  } catch (e) {
    error = e;
  }
  assertTrue(error !== null, '应该抛出异常');
});

console.log('\n--- 幂等性测试 ---');

test('多次低电触发只创建一个活动告警', () => {
  const property = DataStore.addProperty({
    name: '测试房源11',
    address: '测试地址11'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁10',
    model: 'Test-Model-10'
  });
  LockService.updateBatteryLevel(lock.id, 18);
  LockService.updateBatteryLevel(lock.id, 15);
  LockService.updateBatteryLevel(lock.id, 12);
  LockService.updateBatteryLevel(lock.id, 8);
  
  const activeAlerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  assertEqual(activeAlerts.length, 1, '应该只有一个活动告警');
});

console.log('\n--- 历史记录测试 ---');

test('维修单历史记录完整', () => {
  const property = DataStore.addProperty({
    name: '测试房源12',
    address: '测试地址12'
  });
  const lock = LockService.createLock(property.id, {
    name: '测试门锁11',
    model: 'Test-Model-11'
  });
  LockService.updateBatteryLevel(lock.id, 10);
  const alerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === lock.id);
  let order = RepairService.createFromAlert(alerts[0].id, '测试运营');
  order = RepairService.assign(order.id, '维修师傅', '测试运营');
  order = RepairService.start(order.id, '维修师傅');
  order = RepairService.complete(order.id, '完成', '维修师傅');
  
  const history = DataStore.getHistory('repairOrder', order.id);
  assertTrue(history.length >= 4, '应该有至少4条历史记录（创建+指派+开始+完成）');
});

console.log('\n--- 汇总统计测试 ---');

test('汇总统计正确', () => {
  const summary = DataStore.getSummary();
  assertTrue(summary.totalProperties > 0, '应该有房源');
  assertTrue(summary.totalLocks > 0, '应该有门锁');
});

console.log('\n' + '='.repeat(50));
console.log(`测试完成: 通过 ${passed}，失败 ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
