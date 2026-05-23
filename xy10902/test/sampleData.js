const initDatabase = require('../src/config/initDb');
const MonthlyPlan = require('../src/models/MonthlyPlan');
const SubscriptionService = require('../src/services/SubscriptionService');
const GateEventService = require('../src/services/GateEventService');
const SupplementaryService = require('../src/services/SupplementaryService');
const ReconciliationService = require('../src/services/ReconciliationService');

async function loadSampleData() {
  console.log('开始初始化数据库...');
  initDatabase();
  
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n1. 创建月租套餐...');
  const plan1Id = await MonthlyPlan.create({
    plan_name: '月卡A(室内)',
    price: 300,
    duration_days: 30,
    description: '室内停车位月卡套餐'
  });
  const plan2Id = await MonthlyPlan.create({
    plan_name: '月卡B(室外)',
    price: 200,
    duration_days: 30,
    description: '室外停车位月卡套餐'
  });
  const plan3Id = await MonthlyPlan.create({
    plan_name: '季卡',
    price: 800,
    duration_days: 90,
    description: '三个月套餐'
  });
  console.log('   - 套餐创建完成');

  console.log('\n2. 注册车辆并充值...');
  const vehicles = [
    { plate: '京A12345', owner: '张三', phone: '13800138001', amount: 1000 },
    { plate: '京B67890', owner: '李四', phone: '13800138002', amount: 500 },
    { plate: '京C11111', owner: '王五', phone: '13800138003', amount: 200 }
  ];

  for (const v of vehicles) {
    await SubscriptionService.recharge(v.plate, v.amount);
    console.log(`   - ${v.plate} 充值 ${v.amount}元`);
  }

  console.log('\n3. 订阅月租套餐...');
  await SubscriptionService.createSubscription('京A12345', plan1Id);
  await SubscriptionService.createSubscription('京B67890', plan2Id);
  console.log('   - 车辆订阅完成');

  console.log('\n4. 模拟道闸事件...');
  const events = [
    { event_id: 'EVT001', plate: '京A12345', time: '2024-01-15 08:30:00' },
    { event_id: 'EVT002', plate: '京B67890', time: '2024-01-15 09:15:00' },
    { event_id: 'EVT003', plate: '京C11111', time: '2024-01-15 10:00:00' },
    { event_id: 'EVT004', plate: '京A12345', time: '2024-01-15 18:00:00' },
    { event_id: 'EVT005', plate: '未登记车', time: '2024-01-15 12:00:00' }
  ];

  for (const e of events) {
    const result = await GateEventService.processEvent({
      event_id: e.event_id,
      plate_number: e.plate,
      event_type: 'entry',
      event_time: e.time,
      gate_id: 'GATE01',
      direction: 'in'
    });
    console.log(`   - ${e.plate}: ${result.deduction ? result.deduction.type : '处理中'}`);
  }

  console.log('\n5. 创建补扣申请...');
  const app1 = await SupplementaryService.createApplication({
    plate_number: '京C11111',
    original_event_id: 'EVT003',
    amount: 20,
    reason: '设备故障漏扣费',
    applicant: '客服小张'
  });
  console.log(`   - 创建补扣申请: ${app1.supplementary_no}`);

  console.log('\n6. 审核补扣申请...');
  const reviewResult = await SupplementaryService.reviewApplication(
    app1.supplementary_no,
    'approved',
    '管理员小李',
    '情况属实，予以补扣'
  );
  console.log(`   - 审核结果: ${reviewResult.status}`);

  console.log('\n7. 生成对账摘要...');
  const summary = await ReconciliationService.generateSummary('2024-01-15');
  console.log(`   - 总续费金额: ${summary.renewal_amount}元`);
  console.log(`   - 临停扣费次数: ${summary.total_temporary_deductions}`);
  console.log(`   - 道闸事件总数: ${summary.total_gate_events}`);

  console.log('\n=========================================');
  console.log('样例数据加载完成！');
  console.log('=========================================\n');
}

if (require.main === module) {
  loadSampleData().catch(console.error);
}

module.exports = { loadSampleData };
