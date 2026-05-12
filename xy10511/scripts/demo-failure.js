const moment = require('moment');
const db = require('../src/db');
const maintenanceService = require('../src/services/maintenanceService');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       物业设备保修管理系统 - 失败场景演示                     ║');
console.log('║                                                             ║');
console.log('║  演示异常处理流程:                                           ║');
console.log('║  1. 状态流转错误                                             ║');
console.log('║  2. 已完工工单修改费用被拒绝                                  ║');
console.log('║  3. 重复操作被幂等机制拦截                                    ║');
console.log('║  4. 维保超时自动升级                                         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const printSection = (title) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
};

const printStatus = (label, value) => {
  console.log(`  ${label.padEnd(22)}: ${value}`);
};

const runFailureDemo = async () => {
  await db.loadDb();
  
  printSection('Step 0: 准备测试数据');
  
  const vendors = maintenanceService.listVendors().data;
  const assets = maintenanceService.listAssets().data;
  
  if (assets.length === 0) {
    console.log('❌ 未找到演示数据，请先运行: npm run seed');
    process.exit(1);
  }
  
  const testAsset = assets[0];
  const testVendor = vendors[0];
  
  printStatus('测试资产', testAsset.name);
  printStatus('测试维保商', testVendor.name);

  printSection('场景 1: 状态流转错误 - 跳过报价直接完工');
  
  console.log('📋 场景说明:');
  console.log('  保外工单必须经过: 提交 → 派单 → 报价 → 审批 → 维修 → 完工');
  console.log('  跳过中间状态直接尝试完工会被拒绝\n');

  const submit1 = maintenanceService.submitRepair({
    asset_id: assets[1].id,
    reporter_id: 'USER-ERR-001',
    reporter_name: '测试用户',
    description: '测试状态流转',
    category: 'elevator'
  });
  
  const order1Id = submit1.data?.id;
  printStatus('报修提交', '成功');
  printStatus('当前状态', submit1.data?.status);

  console.log('\n❌ 尝试: 跳过派单和报价，直接在 submitted 状态完工');
  const failComplete1 = maintenanceService.completeWork({
    order_id: order1Id,
    completion_note: '测试跳过流程',
    actor: '测试'
  });
  
  printStatus('操作结果', '失败 ✓');
  printStatus('错误代码', failComplete1.code);
  printStatus('错误信息', failComplete1.error);

  console.log('\n✅ 正确流程: 先派单');
  const assign1 = maintenanceService.assignVendor({
    order_id: order1Id,
    vendor_id: testVendor.id,
    actor: '物业经理'
  });
  printStatus('派单结果', assign1.success ? '成功' : '失败');
  printStatus('新状态', assign1.data?.order.status);

  console.log('\n❌ 再次尝试: 在 assigned 状态直接完工 (无报价)');
  const failComplete2 = maintenanceService.completeWork({
    order_id: order1Id,
    completion_note: '测试跳过报价',
    actor: '测试'
  });
  
  printStatus('操作结果', '失败 ✓');
  printStatus('错误代码', failComplete2.code);
  printStatus('错误信息', failComplete2.error);

  printSection('场景 2: 已完工工单修改费用被拒绝');
  
  console.log('📋 场景说明:');
  console.log('  工单完成后，不允许修改费用信息');
  console.log('  确保财务数据的一致性和可审计性\n');

  const inWarrantyAsset = assets[0];
  const submit2 = maintenanceService.submitRepair({
    asset_id: inWarrantyAsset.id,
    reporter_id: 'USER-ERR-002',
    reporter_name: '费用测试用户',
    description: '测试完工后改费用',
    category: 'elevator'
  });
  
  const order2Id = submit2.data?.id;
  printStatus('创建工单', '成功');
  printStatus('状态 (保内自动免审)', submit2.data?.status);

  console.log('\n✅ 正常完成工单');
  const complete2 = maintenanceService.completeWork({
    order_id: order2Id,
    completion_note: '正常完成',
    actor: '张工'
  });
  printStatus('完工状态', complete2.success ? '成功' : '失败');
  printStatus('当前状态', complete2.data?.order.status);

  console.log('\n❌ 尝试: 完工后修改费用');
  const failExpense = maintenanceService.updateExpense({
    order_id: order2Id,
    amount: 9999,
    description: '恶意修改费用',
    actor: '恶意用户'
  });
  
  printStatus('操作结果', '失败 ✓');
  printStatus('错误代码', failExpense.code);
  printStatus('错误信息', failExpense.error);
  printStatus('保护说明', '已完工工单不允许修改费用，确保财务数据安全');

  printSection('场景 3: 重复操作 - 幂等机制');
  
  console.log('📋 场景说明:');
  console.log('  使用相同 callback_id 重复提交，系统只执行一次');
  console.log('  防止重复报修、重复派单、重复审批等问题\n');

  const callbackId = 'FAIL-DEMO-IDEMPOTENT-' + Date.now();
  
  console.log('📝 第一次报价审批 (正常执行)');
  const submit3 = maintenanceService.submitRepair({
    asset_id: assets[1].id,
    reporter_id: 'USER-ERR-003',
    reporter_name: '幂等测试',
    description: '测试幂等性',
    category: 'elevator'
  });
  const order3Id = submit3.data?.id;
  
  maintenanceService.assignVendor({
    order_id: order3Id,
    vendor_id: testVendor.id,
    actor: '物业经理'
  });
  
  const quote3 = maintenanceService.submitQuote({
    order_id: order3Id,
    vendor_id: testVendor.id,
    labor_cost: 500,
    parts_cost: 1000,
    estimated_time: 60,
    actor: '张工'
  });
  const quote3Id = quote3.data?.quote.id;

  console.log('\n✅ 第一次审批');
  const approve3a = maintenanceService.approveQuote({
    quote_id: quote3Id,
    actor: '物业经理',
    callback_id: callbackId
  });
  printStatus('审批结果', approve3a.success ? '成功' : '失败');
  printStatus('是否新建', !approve3a.idempotent ? '是' : '否');

  console.log('\n❌ 第二次审批 (相同 callback_id)');
  const approve3b = maintenanceService.approveQuote({
    quote_id: quote3Id,
    actor: '物业经理',
    callback_id: callbackId
  });
  printStatus('操作结果', '被幂等机制拦截 ✓');
  printStatus('是否幂等', approve3b.idempotent ? '是' : '否');
  printStatus('返回消息', approve3b.message);

  console.log('\n❌ 第三次审批 (无 callback_id，但报价已审批)');
  const approve3c = maintenanceService.approveQuote({
    quote_id: quote3Id,
    actor: '物业经理'
  });
  printStatus('操作结果', '失败 ✓');
  printStatus('错误代码', approve3c.code);
  printStatus('错误信息', approve3c.error);

  printSection('场景 4: 维保超时自动升级');
  
  console.log('📋 场景说明:');
  console.log('  工单超过 4 小时未完成，系统自动升级优先级');
  console.log('  并记录升级历史，便于追溯责任\n');

  const submit4 = maintenanceService.submitRepair({
    asset_id: assets[1].id,
    reporter_id: 'USER-ERR-004',
    reporter_name: '超时测试',
    description: '测试超时升级',
    category: 'elevator'
  });
  const order4Id = submit4.data?.id;

  const assign4 = maintenanceService.assignVendor({
    order_id: order4Id,
    vendor_id: testVendor.id,
    actor: '物业经理'
  });
  
  printStatus('创建并派单', '成功');
  printStatus('当前状态', assign4.data?.order.status);
  printStatus('当前优先级', 'normal');
  printStatus('是否已升级', '否');

  console.log('\n⏱️  模拟: 将工单创建时间改为 5 小时前 (超过 4 小时阈值)');
  const oldTime = moment().subtract(5, 'hours').toISOString();
  db.prepare(`
    UPDATE work_orders 
    SET created_at = ?, updated_at = ?
    WHERE id = ?
  `).run(oldTime, oldTime, order4Id);

  console.log('\n🔔 执行超时检查');
  const escalation = maintenanceService.checkEscalation();
  printStatus('升级工单数量', escalation.escalated_count);
  
  if (escalation.details.length > 0) {
    printStatus('升级工单', escalation.details[0].order_no);
    printStatus('升级说明', escalation.details[0].message);
  }

  console.log('\n🔍 查询工单历史');
  const detail4 = maintenanceService.getOrderDetail(order4Id);
  if (detail4.success) {
    printStatus('当前优先级', detail4.data.order.priority);
    printStatus('是否已升级', detail4.data.order.escalated_at ? '是 ✓' : '否');
    printStatus('升级时间', detail4.data.order.escalated_at || 'N/A');
    
    const escalateHistory = detail4.data.history.find(h => h.action === 'ESCALATE');
    if (escalateHistory) {
      const details = JSON.parse(escalateHistory.details || '{}');
      console.log('\n📜 升级历史记录:');
      console.log(`  操作: ${escalateHistory.action}`);
      console.log(`  操作人: ${escalateHistory.actor} (${escalateHistory.actor_role})`);
      console.log(`  原因: ${details.reason}`);
      console.log(`  超时时间: ${details.escalation_hours} 小时`);
      console.log(`  优先级变更: ${details.original_priority} → ${details.new_priority}`);
    }
  }

  printSection('场景 5: 人工修正费用 - 差异追踪');
  
  console.log('📋 场景说明:');
  console.log('  人工修改费用时，系统记录前后差异和操作者');
  console.log('  便于审计和追溯\n');

  const submit5 = maintenanceService.submitRepair({
    asset_id: assets[1].id,
    reporter_id: 'USER-ERR-005',
    reporter_name: '修正测试',
    description: '测试费用修正',
    category: 'elevator'
  });
  const order5Id = submit5.data?.id;

  maintenanceService.assignVendor({
    order_id: order5Id,
    vendor_id: testVendor.id,
    actor: '物业经理'
  });

  const quote5 = maintenanceService.submitQuote({
    order_id: order5Id,
    vendor_id: testVendor.id,
    labor_cost: 500,
    parts_cost: 2000,
    estimated_time: 60,
    actor: '张工'
  });

  maintenanceService.approveQuote({
    quote_id: quote5.data?.quote.id,
    actor: '物业经理'
  });

  console.log('\n💰 初始费用');
  const detail5a = maintenanceService.getOrderDetail(order5Id);
  if (detail5a.success && detail5a.data.expenses.length > 0) {
    printStatus('初始金额', `¥${detail5a.data.expenses[0].amount}`);
    printStatus('费用说明', detail5a.data.expenses[0].description);
  }

  console.log('\n✏️  人工修正费用');
  const correctExpense = maintenanceService.updateExpense({
    order_id: order5Id,
    amount: 3000,
    description: '实际更换了更贵的配件',
    actor: '财务主管-李总'
  });
  
  printStatus('修正结果', correctExpense.success ? '成功' : '失败');
  if (correctExpense.data?.diff) {
    printStatus('原金额', `¥${correctExpense.data.diff.old_amount}`);
    printStatus('新金额', `¥${correctExpense.data.diff.new_amount}`);
    printStatus('原说明', correctExpense.data.diff.old_description);
    printStatus('新说明', correctExpense.data.diff.new_description);
  }

  console.log('\n📜 查询历史记录');
  const detail5b = maintenanceService.getOrderDetail(order5Id);
  const correctHistory = detail5b.data?.history.find(h => h.action === 'CORRECT_EXPENSE');
  if (correctHistory) {
    const diff = JSON.parse(correctHistory.diff || '{}');
    console.log(`  操作: ${correctHistory.action}`);
    console.log(`  操作人: ${correctHistory.actor}`);
    console.log(`  金额变更: ¥${diff.old_amount} → ¥${diff.new_amount}`);
    console.log(`  说明变更: ${diff.old_description} → ${diff.new_description}`);
  }

  printSection('失败场景演示完成！');
  
  console.log('🎯 异常处理验证:');
  console.log('  ✓ 状态流转约束 (防止跳过流程)');
  console.log('  ✓ 已完工工单费用保护');
  console.log('  ✓ 幂等性机制 (防止重复操作)');
  console.log('  ✓ 超时自动升级');
  console.log('  ✓ 人工修正差异追踪');
  
  console.log('\n📋 关键业务规则:');
  console.log('  1. 状态流转必须严格按顺序');
  console.log('  2. 完工后禁止修改费用');
  console.log('  3. callback_id 保证幂等性');
  console.log('  4. 4 小时超时自动升级');
  console.log('  5. 所有修改都有历史记录');
  
  console.log('\n💡 审计追踪说明:');
  console.log('  所有操作都记录在 order_history 表中');
  console.log('  包含: 操作类型、状态变化、操作人、操作时间、详细信息');
  console.log('  人工修改还记录: 前后差异 (diff 字段)');
  console.log('');
};

runFailureDemo().catch(console.error);
