const DataStore = require('../src/models/data-store');
const LockService = require('../src/services/lock-service');
const RepairService = require('../src/services/repair-service');

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printStep(step, description) {
  console.log(`\n【步骤 ${step}】 ${description}`);
}

function printError(error) {
  console.log(`  ❌ 异常: ${error.message}`);
}

function printSuccess(data, label = '成功') {
  console.log(`  ✓ ${label}`);
  if (typeof data === 'object' && data.id) {
    console.log(`    ID: ${data.id}`);
  }
}

console.log('\n' + '*'.repeat(60));
console.log('*');
console.log('*  短租门锁电量巡检 API - 异常触发路径');
console.log('*');
console.log('*  场景1: 状态流转异常（非法状态转换）');
console.log('*  场景2: 幂等性测试（重复请求）');
console.log('*  场景3: 数据完整性验证');
console.log('*  场景4: 撤回/修正操作');
console.log('*');
console.log('*'.repeat(60));

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

printSection('场景1: 状态流转异常');

printStep(1, '准备基础数据：房源、门锁、订单');
const property = DataStore.addProperty({
  name: '测试房源',
  address: '测试地址'
});
const lock = LockService.createLock(property.id, {
  name: '测试门锁',
  model: 'Test-Model'
});
DataStore.addBooking({
  propertyId: property.id,
  guestName: '测试客人',
  checkIn: tomorrow.toISOString().split('T')[0],
  checkOut: tomorrow.toISOString().split('T')[0]
});
printSuccess(property, '基础数据创建成功');

printStep(2, '门锁电量下降触发告警');
LockService.updateBatteryLevel(lock.id, 5);
const alerts = DataStore.getActiveBatteryAlerts();
const alert = alerts[0];
printSuccess(alert, '告警创建成功');

printStep(3, '创建维修派单');
const repairOrder = RepairService.createFromAlert(alert.id, '测试运营');
printSuccess(repairOrder, '维修单创建成功');

printStep(4, '尝试直接完成维修单（跳过指派和开始步骤）');
try {
  RepairService.complete(repairOrder.id, '跳过流程直接完成');
  console.log('  ⚠️  应该抛出异常但没有抛出');
} catch (error) {
  printError(error);
  console.log('  ✓ 异常捕获成功：正确阻止了非法状态转换');
}

printStep(5, '正确流程：先指派，再开始，再完成');
RepairService.assign(repairOrder.id, '维修师傅A', '运营');
RepairService.start(repairOrder.id, '维修师傅A');
RepairService.complete(repairOrder.id, '正常流程完成', '维修师傅A');
printSuccess(repairOrder, '正常流程完成');

printStep(6, '尝试修改已完成的维修单');
try {
  RepairService.revise(repairOrder.id, { priority: 'high' });
  console.log('  ⚠️  应该抛出异常但没有抛出');
} catch (error) {
  printError(error);
  console.log('  ✓ 异常捕获成功：不能修改已完成的订单');
}

printSection('场景2: 幂等性测试 - 重复请求');

printStep(7, '创建新房源用于幂等测试');
const testProperty = DataStore.addProperty({
  name: '幂等测试房源',
  address: '幂等测试地址'
});
const testLock = LockService.createLock(testProperty.id, {
  name: '幂等测试门锁',
  model: 'Idempotent-Model'
});
printSuccess(testProperty, '测试数据创建成功');

printStep(8, '模拟门锁低电触发告警');
LockService.updateBatteryLevel(testLock.id, 12);
const testAlerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === testLock.id);
const testAlert = testAlerts[0];
printSuccess(testAlert, '告警创建成功');

printStep(9, '多次触发相同电量更新（应该只创建一个告警）');
const alertsBefore = DataStore.getBatteryAlertsByLock(testLock.id).length;
LockService.updateBatteryLevel(testLock.id, 10);
LockService.updateBatteryLevel(testLock.id, 8);
LockService.updateBatteryLevel(testLock.id, 5);
const alertsAfter = DataStore.getBatteryAlertsByLock(testLock.id).filter(a => a.status === 'active').length;
console.log(`  告警数量: ${alertsBefore} → ${alertsAfter}`);
if (alertsAfter === 1) {
  console.log('  ✓ 幂等性验证成功：多次触发只创建一个活动告警');
} else {
  console.log('  ✗ 幂等性验证失败');
}

printSection('场景3: 数据完整性验证');

printStep(10, '尝试为不存在的房源创建门锁');
try {
  LockService.createLock('non-existent-property-id', { name: '测试' });
  console.log('  ⚠️  应该抛出异常但没有抛出');
} catch (error) {
  printError(error);
  console.log('  ✓ 异常捕获成功：验证了外键约束');
}

printStep(11, '尝试设置无效电量值（负数）');
try {
  LockService.updateBatteryLevel(testLock.id, -10);
  console.log('  ⚠️  应该抛出异常但没有抛出');
} catch (error) {
  printError(error);
  console.log('  ✓ 异常捕获成功：验证了电量范围约束');
}

printStep(12, '尝试设置无效电量值（超过100）');
try {
  LockService.updateBatteryLevel(testLock.id, 150);
  console.log('  ⚠️  应该抛出异常但没有抛出');
} catch (error) {
  printError(error);
  console.log('  ✓ 异常捕获成功：验证了电量范围约束');
}

printSection('场景4: 撤回/修正操作（验证历史记录）');

printStep(13, '创建新的测试场景');
const testProperty2 = DataStore.addProperty({
  name: '撤回测试房源',
  address: '撤回测试地址'
});
const testLock2 = LockService.createLock(testProperty2.id, {
  name: '撤回测试门锁',
  model: 'Withdraw-Model'
});
printSuccess(testProperty2, '测试数据创建成功');

printStep(14, '触发低电告警');
LockService.updateBatteryLevel(testLock2.id, 7);
const withdrawAlerts = DataStore.getActiveBatteryAlerts().filter(a => a.lockId === testLock2.id);
const withdrawAlert = withdrawAlerts[0];
printSuccess(withdrawAlert, '告警创建成功');

printStep(15, '确认告警');
LockService.acknowledgeAlert(withdrawAlert.id, '测试运营');
printSuccess(withdrawAlert, '告警已确认');

printStep(16, '发现是误报，撤回告警');
const withdrawnAlert = LockService.withdrawAlert(withdrawAlert.id, '传感器误报，实际电量正常', '测试运营');
console.log(`  告警状态: ${withdrawnAlert.status}`);
console.log(`  撤回原因: ${withdrawnAlert.resolutionReason}`);
console.log('  ✓ 撤回操作成功');

printStep(17, '查看告警历史记录（应该能看到状态变更轨迹）');
const alertHistory = DataStore.getHistory('batteryAlert', withdrawAlert.id);
console.log('  历史记录:');
alertHistory.forEach((record, index) => {
  console.log(`    ${index + 1}. ${record.action}`);
  if (record.previousState) {
    console.log(`       之前状态: ${record.previousState.status || 'N/A'}`);
  }
  if (record.newState) {
    console.log(`       之后状态: ${record.newState.status || 'N/A'}`);
  }
});

printSection('异常演示完成 - 汇总统计');

const summary = DataStore.getSummary();
console.log(`  总房源数: ${summary.totalProperties}`);
console.log(`  总门锁数: ${summary.totalLocks}`);
console.log(`  低电门锁: ${summary.lowBatteryLocks}`);
console.log(`  活动告警: ${summary.activeAlerts}`);
console.log(`  待处理维修: ${summary.pendingRepairs}`);

console.log('\n' + '✓'.repeat(60));
console.log('  异常触发路径演示完成！');
console.log('  验证了：状态流转保护、幂等性、数据约束、撤回/历史记录');
console.log('✓'.repeat(60) + '\n');
