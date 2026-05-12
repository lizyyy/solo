const service = require('../services/schedulingService');
const { createDemoData } = require('../data/seed');

function runDemo() {
  console.log('='.repeat(70));
  console.log('      家政阿姨排班 API - 完整流程演示');
  console.log('='.repeat(70) + '\n');

  const ids = createDemoData();
  const { orderIds, nannyIds } = ids;

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景一】正常派单流程 (王女士 - 日常保洁)');
  console.log('='.repeat(70));
  console.log('  说明: 客户有指定偏好阿姨，技能匹配，路程近，流程顺利\n');

  console.log('--- 步骤 1: 分配阿姨 ---');
  const schedule1 = service.createSchedule(orderIds['王女士'], 'scheduler_1');
  if (schedule1.success) {
    console.log('  ✓ 分配成功');
    console.log('  排班ID:', schedule1.data.id);
    console.log('  分配阿姨:', schedule1.data.nannyName);
    console.log('  推荐分数:', schedule1.data.score);
    console.log('  路程:', schedule1.data.distance, '公里');
    console.log('  当前状态:', schedule1.data.status);
    console.log('  历史记录数:', schedule1.data.history.length);
  } else {
    console.log('  ✗ 分配失败:', schedule1.error);
  }

  console.log('\n--- 步骤 2: 确认排班 ---');
  const confirm1 = service.advanceSchedule(
    schedule1.data.id, 
    service.SCHEDULE_STATUS.CONFIRMED, 
    'scheduler_1'
  );
  if (confirm1.success) {
    console.log('  ✓ 确认成功');
    const lastHistory = confirm1.data.history[confirm1.data.history.length - 1];
    console.log('  状态变化:', lastHistory.fromStatus, '->', lastHistory.toStatus);
  }

  console.log('\n--- 步骤 3: 开始服务 ---');
  const start1 = service.advanceSchedule(
    schedule1.data.id, 
    service.SCHEDULE_STATUS.IN_PROGRESS, 
    '阿姨端'
  );
  console.log('  ✓ 开始服务:', start1.success ? '成功' : '失败');

  console.log('\n--- 步骤 4: 完成服务 ---');
  const complete1 = service.advanceSchedule(
    schedule1.data.id, 
    service.SCHEDULE_STATUS.COMPLETED, 
    '阿姨端'
  );
  console.log('  ✓ 完成服务:', complete1.success ? '成功' : '失败');

  console.log('\n--- 排班详情 ---');
  const detail1 = service.getSchedule(schedule1.data.id);
  console.log('  最终状态:', detail1.data.schedule.status);
  console.log('  历史记录数:', detail1.data.schedule.history.length);
  console.log('  审计日志数:', detail1.data.auditLogs.length);

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景二】技能不匹配 (李先生 - 月嫂服务)');
  console.log('='.repeat(70));
  console.log('  说明: 系统中没有阿姨拥有月嫂技能，导致分配失败\n');

  console.log('--- 尝试分配阿姨 ---');
  const schedule2 = service.createSchedule(orderIds['李先生'], 'scheduler_2');
  console.log('  分配结果:', schedule2.success ? '成功' : '失败');
  
  if (!schedule2.success) {
    console.log('  失败原因:', schedule2.reason);
    console.log('  失败原因码:', schedule2.reasonCode);
    
    if (schedule2.conflicts && schedule2.conflicts.length > 0) {
      console.log('\n  冲突详情:');
      schedule2.conflicts.forEach(c => {
        console.log(`    阿姨: ${c.nannyName}`);
        c.issues.forEach(issue => {
          console.log(`      - [${issue.type}] ${issue.message}`);
        });
      });
    }
  }

  console.log('\n--- 排班状态 ---');
  if (schedule2.data) {
    console.log('  状态:', schedule2.data.status);
    if (schedule2.data.failReason) {
      console.log('  失败原因:', schedule2.data.failReason);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景三】请假换人 (赵女士 - 深度保洁)');
  console.log('='.repeat(70));
  console.log('  说明: 分配阿姨后，阿姨请假，系统触发重新分配并生成补偿\n');

  console.log('--- 步骤 1: 先分配阿姨 ---');
  const schedule3 = service.createSchedule(orderIds['赵女士'], 'scheduler_3');
  if (schedule3.success) {
    console.log('  ✓ 初始分配成功');
    console.log('  分配阿姨:', schedule3.data.nannyName);
    console.log('  当前状态:', schedule3.data.status);
  }

  console.log('\n--- 步骤 2: 阿姨创建请假申请 ---');
  const leave = service.createLeave({
    nannyId: schedule3.data.nannyId,
    nannyName: schedule3.data.nannyName,
    date: '2026-05-13',
    reason: '身体不适，需要休息一天'
  }, '阿姨端');
  console.log('  ✓ 请假申请ID:', leave.data.id);
  console.log('  请假状态:', leave.data.status);

  console.log('\n--- 步骤 3: 批准请假 (触发重新分配) ---');
  const approveLeave = service.approveLeave(leave.data.id, 'admin');
  console.log('  ✓ 批准结果:', approveLeave.success ? '成功' : '失败');
  console.log('  受影响排班数:', approveLeave.affectedSchedules);
  if (approveLeave.affectedScheduleDetails && approveLeave.affectedScheduleDetails.length > 0) {
    console.log('  受影响排班:', approveLeave.affectedScheduleDetails);
  }

  console.log('\n--- 步骤 4: 查看排班状态 ---');
  const schedule3After = service.getSchedule(schedule3.data.id);
  console.log('  当前状态:', schedule3After.data.schedule.status);
  console.log('  重新分配原因:', schedule3After.data.schedule.reassignReason);
  console.log('  换人次数:', schedule3After.data.schedule.reassignCount || 0);

  console.log('\n--- 步骤 5: 执行重新分配 ---');
  const reassignResult = service.reassignSchedule(schedule3.data.id, 'scheduler_3');
  console.log('  重新分配结果:', reassignResult.success ? '成功' : '失败');
  if (reassignResult.success) {
    console.log('  新阿姨:', reassignResult.data.nannyName);
    console.log('  是否同一人:', reassignResult.isSameNanny);
    console.log('  是否创建补偿:', reassignResult.compensationCreated);
  } else {
    console.log('  失败原因:', reassignResult.reason);
    if (reassignResult.conflicts) {
      console.log('  冲突详情:');
      reassignResult.conflicts.forEach(c => {
        console.log(`    阿姨: ${c.nannyName} - 问题: ${c.issues.map(i => i.message).join('; ')}`);
      });
    }
  }

  console.log('\n--- 步骤 6: 查看补偿记录 ---');
  const compensations = service.getAllCompensations();
  console.log('  补偿记录数:', compensations.data.length);
  if (compensations.data.length > 0) {
    const comp = compensations.data[compensations.data.length - 1];
    console.log('  最新补偿:');
    console.log('    ID:', comp.id);
    console.log('    原因:', comp.reason);
    console.log('    金额: ¥', comp.amount);
    console.log('    状态:', comp.status);
  }

  console.log('\n--- 步骤 7: 查看换人历史 ---');
  const reassignHistory = service.getReassignHistory(orderIds['赵女士']);
  if (reassignHistory.success) {
    console.log('  总换人次数:', reassignHistory.data.totalReassigns);
    console.log('  总变动次数:', reassignHistory.data.totalChanges);
    console.log('  补偿总金额: ¥', reassignHistory.data.totalCompensationAmount);
    if (reassignHistory.data.changes.length > 0) {
      console.log('  变动详情:');
      reassignHistory.data.changes.forEach((c, i) => {
        console.log(`    ${i + 1}. [${c.timestamp}] ${c.type}: ${c.reason}`);
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景四】客户拒绝 (孙先生 - 老人护理)');
  console.log('='.repeat(70));
  console.log('  说明: 分配阿姨后，客户拒绝，触发重新分配并记录客户影响\n');

  console.log('--- 步骤 1: 分配阿姨 ---');
  const schedule4 = service.createSchedule(orderIds['孙先生'], 'scheduler_4');
  if (schedule4.success) {
    console.log('  ✓ 分配阿姨:', schedule4.data.nannyName);
    console.log('  当前状态:', schedule4.data.status);
  } else {
    console.log('  ✗ 分配失败:', schedule4.reason);
    console.log('  跳过此场景...');
    console.log('\n' + '='.repeat(70));
    console.log('  演示完成！查看下方报告和统计');
    console.log('='.repeat(70));
    printFinalReport();
    return;
  }

  console.log('\n--- 步骤 2: 客户拒绝 ---');
  const rejectResult = service.advanceSchedule(
    schedule4.data.id, 
    service.SCHEDULE_STATUS.REJECTED, 
    'customer',
    { reason: '对阿姨的经验不满意，要求换人' }
  );
  if (rejectResult.success) {
    console.log('  ✓ 拒绝处理成功');
    console.log('  当前状态:', rejectResult.data.status);
    console.log('  拒绝原因:', rejectResult.data.rejectedReason);
    console.log('  换人次数:', rejectResult.data.reassignCount);
  } else {
    console.log('  ✗ 拒绝处理失败:', rejectResult.error);
  }

  console.log('\n--- 步骤 3: 重新分配 ---');
  const reassign4 = service.reassignSchedule(schedule4.data.id, 'scheduler_4');
  console.log('  重新分配结果:', reassign4.success ? '成功' : '失败');
  if (reassign4.success) {
    console.log('  新阿姨:', reassign4.data.nannyName);
    console.log('  换人次数:', reassign4.data.reassignCount);
  }

  console.log('\n--- 步骤 4: 查看客户影响 ---');
  const impact4 = service.getCustomerImpact(orderIds['孙先生']);
  if (impact4.success) {
    console.log('  客户:', impact4.data.customerName);
    console.log('  客户满意度:', impact4.data.satisfactionLevel);
    console.log('  问题列表:', impact4.data.issues);
    console.log('  拒绝次数:', impact4.data.rejectedCount);
    console.log('  补偿金额: ¥', impact4.data.compensationAmount);
  }

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景五】幂等性测试 (重复调用)');
  console.log('='.repeat(70));
  console.log('  说明: 使用相同幂等键重复调用，应返回相同结果\n');

  const idempotentKey = 'demo_idepotent_key_001_' + Date.now();

  console.log('--- 第一次调用创建订单 ---');
  const order1 = service.createOrder({
    customerName: '测试客户1',
    customerPhone: '13999999999',
    customerArea: '朝阳',
    serviceType: '日常保洁',
    requiredSkills: ['日常保洁'],
    startTime: '10:00',
    endTime: '12:00',
    serviceDate: '2026-05-15',
    idempotentKey: idempotentKey
  }, 'scheduler_test');
  console.log('  订单ID:', order1.data.id);

  console.log('\n--- 第二次调用相同幂等键 ---');
  const order2 = service.createOrder({
    customerName: '测试客户1',
    customerPhone: '13999999999',
    customerArea: '朝阳',
    serviceType: '日常保洁',
    requiredSkills: ['日常保洁'],
    startTime: '10:00',
    endTime: '12:00',
    serviceDate: '2026-05-15',
    idempotentKey: idempotentKey
  }, 'scheduler_test');
  console.log('  订单ID:', order2.data.id);
  console.log('  是否相同:', order1.data.id === order2.data.id ? '✓ 幂等性生效 (相同ID)' : '✗ 幂等性失效');

  console.log('\n' + '='.repeat(70));
  console.log(' 【场景六】人工修正');
  console.log('='.repeat(70));
  console.log('  说明: 管理员人工修改排班，记录前后差异和操作者\n');

  console.log('--- 创建一个订单并分配 ---');
  const orderManual = service.createOrder({
    customerName: '测试客户2',
    customerPhone: '13988888888',
    customerArea: '朝阳',
    serviceType: '日常保洁',
    requiredSkills: ['日常保洁'],
    startTime: '08:00',
    endTime: '10:00',
    serviceDate: '2026-05-15'
  }, 'scheduler_test');

  const scheduleManual = service.createSchedule(orderManual.data.id, 'scheduler_test');
  if (scheduleManual.success) {
    console.log('  ✓ 初始分配成功');
    console.log('  初始阿姨:', scheduleManual.data.nannyName);
  }

  console.log('\n--- 人工修正 ---');
  const manualResult = service.manualCorrect(
    scheduleManual.data.id,
    nannyIds['陈阿姨'],
    'admin_user',
    '客户指定需要陈阿姨'
  );
  if (manualResult.success) {
    console.log('  ✓ 人工修正成功');
    console.log('  新阿姨:', manualResult.data.nannyName);

    console.log('\n--- 查看前后差异 ---');
    console.log('  Before:');
    console.log('    阿姨:', manualResult.diff.before.nannyName);
    console.log('    状态:', manualResult.diff.before.status);
    console.log('  After:');
    console.log('    阿姨:', manualResult.diff.after.nannyName);
    console.log('    状态:', manualResult.diff.after.status);

    console.log('\n--- 查看审计日志 ---');
    const auditLogs = service.getAuditLogs('schedule', scheduleManual.data.id);
    const manualLog = auditLogs.data.find(l => l.action === 'manual_correct');
    if (manualLog) {
      console.log('  人工修正记录:');
      console.log('    操作人:', manualLog.operator);
      console.log('    原因:', manualLog.reason);
      console.log('    时间:', manualLog.timestamp);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  每日报告导出');
  console.log('='.repeat(70) + '\n');

  const report = service.exportReport('2026-05-13');
  if (report.success) {
    console.log('  报告日期:', report.data.reportDate);
    console.log('  生成时间:', report.data.generatedAt);
    console.log('\n--- 汇总 ---');
    console.log('  总排班数:', report.data.summary.totalSchedules);
    console.log('  按状态统计:', JSON.stringify(report.data.summary.byStatus));
    console.log('  冲突数:', report.data.summary.conflictCount);
    console.log('  待重新分配数:', report.data.summary.needsReassignCount);
    console.log('  补偿总数:', report.data.summary.totalCompensations);
    console.log('  补偿总金额: ¥', report.data.summary.totalCompensationAmount);
    console.log('  受影响客户数:', report.data.summary.affectedCustomers);

    if (report.data.conflictDetails && report.data.conflictDetails.length > 0) {
      console.log('\n--- 冲突详情 ---');
      report.data.conflictDetails.forEach(conflict => {
        console.log(`  排班: ${conflict.scheduleId}`);
        console.log(`    原因: ${conflict.failReason}`);
      });
    }

    if (report.data.customerImpacts) {
      const affected = report.data.customerImpacts.filter(i => i.issues.length > 0);
      if (affected.length > 0) {
        console.log('\n--- 客户影响分析 ---');
        affected.forEach(impact => {
          console.log(`  客户: ${impact.customerName}`);
          console.log(`    满意度: ${impact.satisfactionLevel}`);
          console.log(`    问题: ${impact.issues.join('; ')}`);
          console.log(`    补偿: ¥${impact.compensationAmount}`);
        });
      }
    }
  }

  printFinalReport();
}

function printFinalReport() {
  console.log('\n' + '='.repeat(70));
  console.log('  最终数据统计');
  console.log('='.repeat(70) + '\n');
  
  console.log('  阿姨数:', service.getAllNannies().data.length);
  console.log('  技能数:', service.getAllSkills().data.length);
  console.log('  订单数:', service.getAllOrders().data.length);
  
  const report12 = service.exportReport('2026-05-12');
  const report13 = service.exportReport('2026-05-13');
  const report15 = service.exportReport('2026-05-15');
  const totalSchedules = report12.data.summary.totalSchedules + 
                         report13.data.summary.totalSchedules + 
                         report15.data.summary.totalSchedules;
  console.log('  排班数:', totalSchedules);
  
  console.log('  请假数:', service.getAllLeaves().data.length);
  console.log('  补偿数:', service.getAllCompensations().data.length);
  console.log('  审计日志数:', service.getAuditLogs().data.length);

  console.log('\n' + '='.repeat(70));
  console.log('  演示完成！');
  console.log('='.repeat(70));
  console.log('\n  你可以通过以下方式验证业务闭环:');
  console.log('  1. 查看每日排班: GET /api/v1/schedules/daily/2026-05-13');
  console.log('  2. 查看冲突原因: 在排班详情中查看 conflicts 和 failReason');
  console.log('  3. 查看换班历史: GET /api/v1/orders/:id/reassign-history');
  console.log('  4. 查看客户影响: GET /api/v1/orders/:id/customer-impact');
  console.log('  5. 查看审计日志: GET /api/v1/audit-logs');
  console.log('  6. 导出报告: GET /api/v1/reports/daily/2026-05-13');
  console.log('');
}

if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };
