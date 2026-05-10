const assert = require('assert');
const store = require('../src/models/store');
const appointmentService = require('../src/services/appointmentService');
const coldChainService = require('../src/services/coldChainService');
const reportService = require('../src/services/reportService');

console.log('═'.repeat(80));
console.log('🏥 诊所疫苗预约冷链 API - 主流程测试');
console.log('═'.repeat(80));

store.initSampleData();

function logSection(title) {
  console.log('\n' + '─'.repeat(60));
  console.log('📌 ' + title);
  console.log('─'.repeat(60));
}

function logPass(message) {
  console.log('✅ ' + message);
}

function logResult(label, value) {
  console.log(`   ${label}:`, value);
}

try {
  logSection('步骤 1: 查看初始剂次报表');
  
  const initialReport = reportService.getDoseReport();
  logResult('HPV疫苗初始可用剂次', initialReport.vaccineInventory[0].availableDoses);
  logResult('HPV疫苗初始锁定剂次', initialReport.vaccineInventory[0].lockedDoses);
  assert.strictEqual(initialReport.vaccineInventory[0].availableDoses, 80, 'HPV疫苗初始可用剂次应为80');
  assert.strictEqual(initialReport.vaccineInventory[0].lockedDoses, 0, 'HPV疫苗初始锁定剂次应为0');
  logPass('初始报表验证通过');

  logSection('步骤 2: 创建3个HPV疫苗预约（验证预约锁定机制）');
  
  const appointment1 = appointmentService.createAppointment({
    patientName: '张三',
    patientId: 'P001',
    vaccineId: 'v1',
    appointmentDate: '2025-01-15'
  });
  
  logResult('预约1 - 批号', appointment1.appointment.batchNo);
  logResult('预约1 - 冷链箱', appointment1.appointment.coldBoxId);
  logResult('预约1 - 锁定后可用剂次', appointment1.inventory.availableDoses);
  logResult('预约1 - 锁定剂次', appointment1.inventory.lockedDoses);
  
  assert.strictEqual(appointment1.appointment.batchNo, 'HPV-2024-002', '应先使用较早过期批次');
  assert.strictEqual(appointment1.inventory.availableDoses, 29, '可用剂次应减少1');
  assert.strictEqual(appointment1.inventory.lockedDoses, 1, '锁定剂次应增加1');
  logPass('预约1创建成功，批号HPV-2024-002已锁定');

  const appointment2 = appointmentService.createAppointment({
    patientName: '李四',
    patientId: 'P002',
    vaccineId: 'v1',
    appointmentDate: '2025-01-16',
    inventoryId: 'inv1'
  });
  
  logResult('预约2 - 指定批号', appointment2.appointment.batchNo);
  logResult('预约2 - 锁定后可用剂次', appointment2.inventory.availableDoses);
  
  assert.strictEqual(appointment2.appointment.batchNo, 'HPV-2024-001', '应使用指定的inv1库存');
  assert.strictEqual(appointment2.inventory.availableDoses, 49, 'inv1可用剂次应减少1');
  logPass('预约2创建成功，指定批号HPV-2024-001已锁定');

  const appointment3 = appointmentService.createAppointment({
    patientName: '王五',
    patientId: 'P003',
    vaccineId: 'v1',
    appointmentDate: '2025-01-17'
  });
  
  logResult('预约3 - 批次', appointment3.appointment.batchNo);
  logPass('预约3创建成功');

  const midReport = reportService.getDoseReport();
  logResult('3个预约后 - 总可用剂次', midReport.vaccineInventory[0].availableDoses);
  logResult('3个预约后 - 总锁定剂次', midReport.vaccineInventory[0].lockedDoses);
  assert.strictEqual(midReport.vaccineInventory[0].availableDoses, 77, '总可用剂次应为77');
  assert.strictEqual(midReport.vaccineInventory[0].lockedDoses, 3, '总锁定剂次应为3');
  logPass('3个预约后剂次统计正确');

  logSection('步骤 3: 取消预约2（验证剂次释放机制）');
  
  const cancelResult = appointmentService.cancelAppointment(appointment2.appointment.id, '患者临时有事');
  logResult('取消的预约ID', appointment2.appointment.id);
  logResult('取消原因', cancelResult.appointment.cancelledReason);
  logResult('释放后 - 批次可用剂次', cancelResult.inventory.availableDoses);
  logResult('释放后 - 批次锁定剂次', cancelResult.inventory.lockedDoses);
  
  assert.strictEqual(cancelResult.appointment.status, 'cancelled', '预约状态应为已取消');
  assert.strictEqual(cancelResult.inventory.availableDoses, 50, '可用剂次应恢复到50');
  assert.strictEqual(cancelResult.inventory.lockedDoses, 0, '锁定剂次应恢复到0');
  logPass('预约2取消成功，批号HPV-2024-001剂次已释放');

  const afterCancelReport = reportService.getDoseReport();
  logResult('取消后 - 总可用剂次', afterCancelReport.vaccineInventory[0].availableDoses);
  logResult('取消后 - 总锁定剂次', afterCancelReport.vaccineInventory[0].lockedDoses);
  assert.strictEqual(afterCancelReport.vaccineInventory[0].availableDoses, 78, '总可用剂次应为78');
  assert.strictEqual(afterCancelReport.vaccineInventory[0].lockedDoses, 2, '总锁定剂次应为2');
  logPass('取消后剂次统计正确');

  logSection('步骤 4: 预约1改约到另一个批次（验证改约释放+锁定）');
  
  const rescheduleResult = appointmentService.rescheduleAppointment(
    appointment1.appointment.id,
    '2025-02-01',
    'inv1'
  );
  
  logResult('改约前批次', 'HPV-2024-002');
  logResult('改约后批次', rescheduleResult.appointment.batchNo);
  logResult('旧批次可用剂次', rescheduleResult.oldInventory.availableDoses);
  logResult('新批次可用剂次', rescheduleResult.newInventory.availableDoses);
  logResult('新批次锁定剂次', rescheduleResult.newInventory.lockedDoses);
  
  assert.strictEqual(rescheduleResult.appointment.batchNo, 'HPV-2024-001', '应改约到inv1');
  assert.strictEqual(rescheduleResult.oldInventory.availableDoses, 29, '旧批次可用剂次应恢复(预约3仍锁定1剂)');
  assert.strictEqual(rescheduleResult.newInventory.availableDoses, 49, '新批次可用剂次应减少');
  assert.strictEqual(rescheduleResult.newInventory.lockedDoses, 1, '新批次锁定剂次应增加');
  logPass('改约成功：旧批次HPV-2024-002释放，新批次HPV-2024-001锁定');

  logSection('步骤 5: 完成预约（验证剂次消耗）');
  
  const completeResult = appointmentService.completeAppointment(appointment1.appointment.id);
  logResult('完成的预约ID', appointment1.appointment.id);
  logResult('预约状态', completeResult.appointment.status);
  logResult('完成后总剂次', completeResult.inventory.totalDoses);
  
  assert.strictEqual(completeResult.appointment.status, 'completed', '预约状态应为已完成');
  assert.strictEqual(completeResult.inventory.totalDoses, 49, '总剂次应减少1');
  assert.strictEqual(completeResult.inventory.lockedDoses, 0, '锁定剂次应释放');
  logPass('预约1完成，批号HPV-2024-001剂次已消耗');

  logSection('步骤 6: 模拟冷链箱异常（验证异常冻结机制）');
  
  const coldStatusBefore = coldChainService.getColdChainStatus();
  logResult('冷链箱box1状态(异常前)', coldStatusBefore.coldBoxes[0].status);
  
  const exceptionResult = coldChainService.reportColdBoxException(
    'box1',
    'temperature_high',
    15,
    { cause: '设备故障', duration: 30 }
  );
  
  logResult('异常类型', exceptionResult.exception.type);
  logResult('异常温度', exceptionResult.exception.temperature);
  logResult('冻结的批次数量', exceptionResult.affectedInventory.length);
  
  const affectedBatch = exceptionResult.affectedInventory.find(b => b.batchNo === 'HPV-2024-001');
  logResult('HPV-2024-001冻结剂次', affectedBatch.totalFrozen);
  
  assert.strictEqual(exceptionResult.coldBox.status, 'exception', '冷链箱状态应为异常');
  logPass('冷链异常已记录，相关批次已冻结');

  const coldStatusAfter = coldChainService.getColdChainStatus();
  logResult('冷链箱box1状态(异常后)', coldStatusAfter.coldBoxes[0].status);
  logResult('总冻结剂次', coldStatusAfter.summary.frozenDoses);
  assert.strictEqual(coldStatusAfter.summary.frozenDoses, 149, '冻结剂次应为149(HPV-2024-001:49 + COVID-2024-001:100)');
  logPass('异常后剂次统计正确');

  logSection('步骤 7: 尝试预约异常冷链箱中的疫苗（应被拒绝）');
  
  try {
    appointmentService.createAppointment({
      patientName: '赵六',
      patientId: 'P004',
      vaccineId: 'v1',
      appointmentDate: '2025-02-15',
      inventoryId: 'inv1'
    });
    throw new Error('应该抛出异常');
  } catch (err) {
    logResult('拒绝原因', err.message);
    assert(err.message.includes('状态异常') || err.message.includes('frozen'), '应该因冷链异常被拒绝');
    logPass('异常冷链箱中的疫苗无法预约，被正确拒绝');
  }

  logSection('步骤 8: 人工修正冷链异常（验证解冻释放）');
  
  const resolveResult = coldChainService.resolveColdBoxException('box1', 'release', true);
  logResult('人工修正标志', resolveResult.manualCorrection);
  logResult('解冻释放的批次数量', resolveResult.affectedInventory.length);
  
  const releasedBatch = resolveResult.affectedInventory.find(b => b.batchNo === 'HPV-2024-001');
  logResult('HPV-2024-001释放剂次', releasedBatch.releasedDoses);
  
  assert.strictEqual(resolveResult.coldBox.status, 'normal', '冷链箱状态应恢复正常');
  logPass('人工修正成功，疫苗已释放');

  const finalReport = reportService.getDoseReport();
  logResult('最终 - 总可用剂次', finalReport.summary.totalAvailableDoses);
  logResult('最终 - 总锁定剂次', finalReport.summary.totalLockedDoses);
  logResult('最终 - 总已使用剂次', finalReport.summary.totalUsedDoses);
  logResult('最终 - 总预约数', finalReport.appointments.total);
  logResult('最终 - 已完成预约', finalReport.appointments.completed);
  logResult('最终 - 已取消预约', finalReport.appointments.cancelled);

  logSection('步骤 9: 查看批次详细报表');
  
  const batchReport = reportService.getBatchReport('HPV-2024-001');
  logResult('批次报表 - 批号', batchReport.batch.batchNo);
  logResult('批次报表 - 状态', batchReport.batch.status);
  logResult('批次报表 - 相关预约数', batchReport.appointments.total);
  logPass('批次报表生成成功');

  console.log('\n' + '═'.repeat(80));
  console.log('🎉 主流程测试全部通过!');
  console.log('═'.repeat(80));
  console.log('\n📊 业务闭环验证总结:');
  console.log('   ✓ 疫苗批号绑定：预约时选择具体批次');
  console.log('   ✓ 预约锁定机制：创建预约时锁定剂次');
  console.log('   ✓ 取消释放机制：取消预约时释放剂次');
  console.log('   ✓ 改约释放+锁定：改约时释放旧批次，锁定新批次');
  console.log('   ✓ 冷链状态监控：实时监控冷链箱状态');
  console.log('   ✓ 异常冻结机制：冷链异常时冻结所有相关剂次');
  console.log('   ✓ 人工修正释放：人工修正后解冻释放剂次');
  console.log('   ✓ 剂次报表统计：完整追踪剂次流转');
  console.log('\n');
  
} catch (err) {
  console.error('\n❌ 测试失败:', err.message);
  console.error(err.stack);
  process.exit(1);
}
