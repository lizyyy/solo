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

function printResult(data, label = '结果') {
  console.log(`  ${label}:`);
  if (typeof data === 'object') {
    const lines = JSON.stringify(data, null, 2).split('\n');
    lines.forEach(line => console.log(`    ${line}`));
  } else {
    console.log(`    ${data}`);
  }
}

console.log('\n' + '*'.repeat(60));
console.log('*');
console.log('*  短租门锁电量巡检 API - 最短演示路径');
console.log('*');
console.log('*  场景: 房源门锁电量低 → 触发告警 → 影响即将入住的订单');
console.log('*        → 创建维修派单 → 完成维修');
console.log('*');
console.log('*'.repeat(60));

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfter = new Date();
dayAfter.setDate(dayAfter.getDate() + 3);

printSection('第一步：基础数据准备');

printStep(1, '创建房源（阳光公寓 A-101');
const property = DataStore.addProperty({
  name: '阳光公寓 A-101',
  address: '北京市朝阳区阳光路100号'
});
printResult(property, '房源信息');

printStep(2, '创建智能门锁（安装在该房源');
const lock = LockService.createLock(property.id, {
  name: '主门锁',
  model: 'SmartLock-Pro-2024'
});
printResult(lock, '门锁信息');

printStep(3, '创建即将入住的订单（明天入住）');
const booking = DataStore.addBooking({
  propertyId: property.id,
  guestName: '张三',
  checkIn: tomorrow.toISOString().split('T')[0],
  checkOut: dayAfter.toISOString().split('T')[0]
});
printResult(booking, '订单信息');

printSection('第二步：门锁电量巡检 - 触发告警');

printStep(4, '模拟门锁电量下降到 8%（严重低电）');
const updatedLock = LockService.updateBatteryLevel(lock.id, 8);
printResult({
  id: updatedLock.id,
  batteryLevel: updatedLock.batteryLevel,
  status: updatedLock.status
}, '门锁状态');

printStep(5, '查询活动告警（自动创建的低电告警）');
const alerts = DataStore.getActiveBatteryAlerts();
const alert = alerts[0];
printResult({
  id: alert.id,
  status: alert.status,
  urgency: alert.urgency,
  batteryLevel: alert.batteryLevel,
  impactAnalysis: alert.impactAnalysis
}, '告警详情');

printSection('第三步：维修派单流程');

printStep(6, '运营人员确认告警');
const acknowledgedAlert = LockService.acknowledgeAlert(alert.id, '运营小王');
printResult({
  id: acknowledgedAlert.id,
  status: acknowledgedAlert.status,
  acknowledgedAt: acknowledgedAlert.acknowledgedAt,
  acknowledgedBy: acknowledgedAlert.acknowledgedBy
}, '已确认告警');

printStep(7, '从告警创建维修派单（自动关联订单影响分析）');
const repairOrder = RepairService.createFromAlert(alert.id, '运营小王');
printResult({
  id: repairOrder.id,
  status: repairOrder.status,
  priority: repairOrder.priority,
  urgency: repairOrder.urgency,
  impactAnalysis: repairOrder.impactAnalysis
}, '维修单信息');

printStep(8, '指派维修师傅');
const assignedOrder = RepairService.assign(repairOrder.id, '维修李师傅', '运营小王');
printResult({
  id: assignedOrder.id,
  status: assignedOrder.status,
  assignedTo: assignedOrder.assignedTo
}, '已指派');

printStep(9, '维修师傅开始维修');
const startedOrder = RepairService.start(repairOrder.id, '维修李师傅');
printResult({
  id: startedOrder.id,
  status: startedOrder.status,
  startedAt: startedOrder.startedAt
}, '维修中');

printStep(10, '维修完成（更换电池）');
const completedOrder = RepairService.complete(
  repairOrder.id,
  '已更换4节5号电池，门锁恢复正常',
  '维修李师傅'
);
printResult({
  id: completedOrder.id,
  status: completedOrder.status,
  completedAt: completedOrder.completedAt,
  completionNotes: completedOrder.completionNotes
}, '维修完成');

printSection('第四步：验证状态恢复');

printStep(11, '检查门锁电量状态（自动恢复100%）');
const finalLock = DataStore.getLock(lock.id);
printResult({
  id: finalLock.id,
  batteryLevel: finalLock.batteryLevel,
  status: finalLock.status
}, '门锁状态');

printStep(12, '检查告警状态（自动解决）');
const finalAlert = DataStore.getBatteryAlert(alert.id);
printResult({
  id: finalAlert.id,
  status: finalAlert.status,
  resolvedAt: finalAlert.resolvedAt,
  resolutionReason: finalAlert.resolutionReason
}, '告警状态');

printSection('第五步：查看历史记录');

printStep(13, '查看维修单完整历史（包含所有状态变更）');
const history = DataStore.getHistory('repairOrder', repairOrder.id);
console.log('  历史记录:');
history.forEach((record, index) => {
  console.log(`    ${index + 1}. ${record.action} - ${record.timestamp}`);
  console.log(`       操作人: ${record.operator}`);
});

printSection('演示完成 - 汇总统计');

const summary = DataStore.getSummary();
printResult(summary, '系统汇总');

console.log('\n' + '✓'.repeat(60));
console.log('  最短演示路径执行成功！');
console.log('✓'.repeat(60) + '\n');
