const moment = require('moment');
const db = require('../src/db');
const maintenanceService = require('../src/services/maintenanceService');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         物业设备保修管理系统 - 主演示流程                    ║');
console.log('║                                                             ║');
console.log('║  演示场景:                                                   ║');
console.log('║  1. 保内维修 (自动免审流程)                                   ║');
console.log('║  2. 保外报价审批流程                                         ║');
console.log('║  3. 重复报修合并                                             ║');
console.log('║  4. 幂等性验证                                               ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const printSection = (title) => {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}\n`);
};

const printStatus = (label, value) => {
  console.log(`  ${label.padEnd(20)}: ${value}`);
};

const runDemo = async () => {
  await db.loadDb();
  
  printSection('Step 0: 初始化演示数据');
  
  const vendors = maintenanceService.listVendors().data;
  const assets = maintenanceService.listAssets().data;
  
  if (assets.length === 0) {
    console.log('❌ 未找到演示数据，请先运行: npm run seed');
    process.exit(1);
  }
  
  const inWarrantyAsset = assets.find(a => a.asset_code === 'ELEV-A01-001');
  const outWarrantyAsset = assets.find(a => a.asset_code === 'ELEV-B01-002');
  const elevatorVendor = vendors[0];
  
  printStatus('保内资产', inWarrantyAsset.name);
  printStatus('保外资产', outWarrantyAsset.name);
  printStatus('维保商', elevatorVendor.name);

  printSection('场景 1: 保内维修 - 自动免审流程');
  
  console.log('📋 场景说明:');
  console.log('  资产仍在保修期内，报修后系统自动派单并免审进入维修状态');
  console.log('  费用由维保商承担\n');

  const submit1 = maintenanceService.submitRepair({
    asset_id: inWarrantyAsset.id,
    reporter_id: 'USER001',
    reporter_name: '张先生',
    description: '电梯运行时有异响，3-5层明显',
    category: 'elevator',
    priority: 'high',
    callback_id: 'CB-001'
  });

  const order1Id = submit1.data?.id || submit1.parent_order_id;
  printStatus('报修提交', submit1.success ? '成功' : '失败');
  printStatus('工单编号', submit1.data?.order_no || 'N/A');
  printStatus('当前状态', submit1.data?.status || 'N/A');
  printStatus('保修状态', submit1.data?.warranty_status || 'N/A');
  printStatus('是否自动免审', submit1.data?.status === 'in_progress' ? '是' : '否');

  await delay(500);
  
  const detail1 = maintenanceService.getOrderDetail(order1Id);
  if (detail1.success) {
    console.log('\n🔍 工单详情:');
    printStatus('当前责任方', detail1.data.current_responsible.party);
    printStatus('责任说明', detail1.data.current_responsible.description);
    printStatus('费用归属', detail1.data.warranty_info.in_warranty ? '维保商' : '物业');
    
    console.log('\n📜 历史记录:');
    detail1.data.history.forEach((h, i) => {
      const details = JSON.parse(h.details || '{}');
      console.log(`  ${i + 1}. [${h.action}] ${h.old_status || 'NEW'} → ${h.new_status}`);
      console.log(`     操作人: ${h.actor}, 时间: ${h.created_at.substring(0, 19)}`);
      if (details.reason) console.log(`     备注: ${details.reason}`);
    });
  }

  console.log('\n🔧 推进: 完成维修');
  const complete1 = maintenanceService.completeWork({
    order_id: order1Id,
    completion_note: '更换了曳引机轴承，异响问题已解决',
    actual_time: 120,
    actor: '张工',
    callback_id: 'CB-COMPLETE-001'
  });
  printStatus('完工状态', complete1.success ? '成功' : '失败');
  if (complete1.success) {
    printStatus('新状态', complete1.data.order.status);
  }

  console.log('\n⭐ 推进: 用户评价');
  const evaluate1 = maintenanceService.evaluate({
    order_id: order1Id,
    rating: 5,
    response_time_rating: 5,
    quality_rating: 5,
    price_rating: 5,
    comment: '响应迅速，维修专业，保内服务非常省心！',
    evaluator: '张先生'
  });
  printStatus('评价状态', evaluate1.success ? '成功' : '失败');

  await delay(500);
  const detail1Final = maintenanceService.getOrderDetail(order1Id);
  if (detail1Final.success) {
    console.log('\n💰 费用明细:');
    detail1Final.data.expenses.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.category}: ¥${e.amount}`);
      console.log(`     支付方: ${e.payer === 'vendor' ? '维保商 (保内)' : '物业 (保外)'}`);
      console.log(`     说明: ${e.description}`);
    });
  }

  printSection('场景 2: 保外报价审批流程');
  
  console.log('📋 场景说明:');
  console.log('  资产已过保修期，需要维保商报价，物业审批后才能维修');
  console.log('  费用由物业承担\n');

  const submit2 = maintenanceService.submitRepair({
    asset_id: outWarrantyAsset.id,
    reporter_id: 'USER002',
    reporter_name: '李女士',
    description: '货梯按钮失灵，楼层无法选择',
    category: 'elevator',
    priority: 'normal'
  });

  const order2Id = submit2.data?.id;
  printStatus('报修提交', submit2.success ? '成功' : '失败');
  printStatus('工单编号', submit2.data?.order_no || 'N/A');
  printStatus('当前状态', submit2.data?.status || 'N/A');
  printStatus('保修状态', submit2.data?.warranty_status || 'N/A');

  await delay(500);

  console.log('\n📋 推进: 物业派单');
  const assign2 = maintenanceService.assignVendor({
    order_id: order2Id,
    vendor_id: elevatorVendor.id,
    actor: '物业经理-王经理'
  });
  printStatus('派单状态', assign2.success ? '成功' : '失败');
  if (assign2.success) {
    printStatus('派给维保商', assign2.data.vendor.name);
    printStatus('新状态', assign2.data.order.status);
  }

  await delay(500);

  console.log('\n💰 推进: 维保商报价 (超过阈值需要审批)');
  const quote2 = maintenanceService.submitQuote({
    order_id: order2Id,
    vendor_id: elevatorVendor.id,
    labor_cost: 800,
    parts_cost: 5500,
    other_cost: 200,
    estimated_time: 180,
    quote_note: '需要更换按钮面板总成和控制模块',
    actor: '张工'
  });
  printStatus('报价状态', quote2.success ? '成功' : '失败');
  if (quote2.success) {
    printStatus('总报价', `¥${quote2.data.quote.total_cost}`);
    printStatus('需要审批', quote2.data.needs_approval ? '是 (超过¥5000)' : '否');
    printStatus('当前状态', 'quoted (待审批)');
  }

  await delay(500);

  const quote2Id = quote2.data?.quote.id;
  
  console.log('\n✅ 推进: 物业审批报价');
  const approve2 = maintenanceService.approveQuote({
    quote_id: quote2Id,
    actor: '物业经理-王经理'
  });
  printStatus('审批状态', approve2.success ? '成功' : '失败');
  if (approve2.success) {
    printStatus('新状态', approve2.data.order.status);
    printStatus('费用归属', approve2.data.expense.payer === 'property' ? '物业 (保外)' : '维保商');
  }

  await delay(500);

  console.log('\n🔧 推进: 完成维修');
  const complete2 = maintenanceService.completeWork({
    order_id: order2Id,
    completion_note: '已更换按钮面板和控制模块，功能恢复正常',
    actual_time: 150,
    actor: '张工'
  });
  printStatus('完工状态', complete2.success ? '成功' : '失败');

  console.log('\n⭐ 推进: 用户评价');
  const evaluate2 = maintenanceService.evaluate({
    order_id: order2Id,
    rating: 4,
    response_time_rating: 4,
    quality_rating: 4,
    price_rating: 3,
    comment: '维修质量还行，但价格有点贵',
    evaluator: '李女士'
  });
  printStatus('评价状态', evaluate2.success ? '成功' : '失败');

  await delay(500);
  
  const detail2Final = maintenanceService.getOrderDetail(order2Id);
  if (detail2Final.success) {
    console.log('\n📜 完整历史记录:');
    detail2Final.data.history.forEach((h, i) => {
      console.log(`  ${i + 1}. [${h.action}] ${h.old_status || 'NEW'} → ${h.new_status}`);
      console.log(`     操作人: ${h.actor} (${h.actor_role})`);
    });
  }

  printSection('场景 3: 重复报修合并');
  
  console.log('📋 场景说明:');
  console.log('  24小时内同一资产相似问题的报修会自动合并');
  console.log('  避免重复派单和资源浪费\n');

  console.log('📝 第一次报修 (创建新工单)');
  const submit3 = maintenanceService.submitRepair({
    asset_id: outWarrantyAsset.id,
    reporter_id: 'USER003',
    reporter_name: '陈先生',
    description: '货梯按键没反应，按下去没动静',
    category: 'elevator',
    priority: 'normal'
  });

  const order3Id = submit3.data?.id;
  printStatus('报修提交', submit3.success ? '成功' : '失败');
  printStatus('工单编号', submit3.data?.order_no || 'N/A');
  printStatus('状态', submit3.data?.status || 'N/A');

  await delay(500);

  console.log('\n📝 第二次报修 (相似描述，应该被合并)');
  const submit3b = maintenanceService.submitRepair({
    asset_id: outWarrantyAsset.id,
    reporter_id: 'USER004',
    reporter_name: '刘小姐',
    description: 'B栋货梯按钮按不动，无法选择楼层',
    category: 'elevator',
    priority: 'high'
  });

  printStatus('报修提交', submit3b.success ? '成功' : '失败');
  printStatus('是否合并', submit3b.merged ? '是 ✓' : '否');
  if (submit3b.merged) {
    printStatus('合并到工单', submit3b.parent_order_no);
    printStatus('原工单ID', submit3b.parent_order_id);
  }

  await delay(500);

  const detail3 = maintenanceService.getOrderDetail(order3Id);
  if (detail3.success && detail3.data.merged_orders.length > 0) {
    console.log('\n🔗 合并的报修记录:');
    detail3.data.merged_orders.forEach((m, i) => {
      console.log(`  ${i + 1}. ${m.reporter_name}: ${m.description}`);
      console.log(`     合并时间: ${m.merged_at.substring(0, 19)}`);
    });
  }

  printSection('场景 4: 幂等性验证');
  
  console.log('📋 场景说明:');
  console.log('  使用相同的 callback_id 重复提交，系统返回首次结果\n');

  const callbackId = 'IDEMPOTENT-TEST-001';
  
  console.log('📝 第一次提交 (新建工单)');
  const submit4a = maintenanceService.submitRepair({
    asset_id: inWarrantyAsset.id,
    reporter_id: 'USER005',
    reporter_name: '赵先生',
    description: '电梯门开合不顺畅',
    category: 'elevator',
    callback_id: callbackId
  });
  printStatus('是否新建', !submit4a.idempotent ? '是' : '否');
  printStatus('工单编号', submit4a.data?.order_no || 'N/A');

  console.log('\n📝 第二次提交 (相同callback_id)');
  const submit4b = maintenanceService.submitRepair({
    asset_id: inWarrantyAsset.id,
    reporter_id: 'USER005',
    reporter_name: '赵先生',
    description: '电梯门开合不顺畅',
    category: 'elevator',
    callback_id: callbackId
  });
  printStatus('是否幂等', submit4b.idempotent ? '是 ✓' : '否');
  printStatus('返回结果', submit4b.message);

  printSection('报告导出');

  console.log('📊 生成月度汇总报告');
  const monthlyReport = maintenanceService.generateReport('monthly_summary');
  if (monthlyReport.success) {
    const data = monthlyReport.data;
    printStatus('总工单数量', data.total_orders);
    printStatus('总费用', `¥${data.total_cost}`);
    printStatus('保内工单', data.warranty_breakdown.in_warranty);
    printStatus('保外工单', data.warranty_breakdown.out_of_warranty);
    console.log('\n状态分布:');
    Object.entries(data.status_breakdown || {}).forEach(([status, count]) => {
      printStatus(`  ${status}`, count);
    });
  }

  console.log('\n📊 维保商绩效报告');
  const vendorReport = maintenanceService.generateReport('vendor_performance');
  if (vendorReport.success) {
    vendorReport.data.forEach((v, i) => {
      console.log(`\n  ${i + 1}. ${v.vendor_name}`);
      printStatus('    总工单', v.total_orders);
      printStatus('    已完成', v.completed_orders);
      printStatus('    完成率', `${v.completion_rate}%`);
      printStatus('    当前评分', v.current_rating);
    });
  }

  console.log('\n📊 资产成本分析');
  const assetReport = maintenanceService.generateReport('asset_cost_analysis');
  if (assetReport.success) {
    assetReport.data.forEach((a, i) => {
      console.log(`\n  ${i + 1}. ${a.asset_name} (${a.warranty_status === 'in_warranty' ? '保内' : '保外'})`);
      printStatus('    维修次数', a.total_repair_count);
      printStatus('    总费用', `¥${a.total_repair_cost}`);
      printStatus('    保修到期', a.warranty_end);
    });
  }

  printSection('资产历史查询');
  
  const assetHistory = maintenanceService.getAssetHistory(outWarrantyAsset.id);
  if (assetHistory.success) {
    console.log(`📍 资产: ${assetHistory.data.asset.name}`);
    printStatus('保修状态', assetHistory.data.warranty_status === 'in_warranty' ? '保内' : '保外');
    printStatus('历史工单', assetHistory.data.total_orders);
    printStatus('累计费用', `¥${assetHistory.data.total_cost}`);
    
    console.log('\n📋 工单列表:');
    assetHistory.data.orders.forEach((o, i) => {
      console.log(`  ${i + 1}. ${o.order_no} - ${o.status}`);
      console.log(`     ${o.description}`);
      const totalCost = o.expenses.reduce((s, e) => s + e.amount, 0);
      console.log(`     费用: ¥${totalCost}`);
    });
  }

  printSection('演示完成！');
  
  console.log('🎯 核心功能验证:');
  console.log('  ✓ 资产建档与保修状态判断');
  console.log('  ✓ 保内自动免审流程');
  console.log('  ✓ 保外报价审批流程');
  console.log('  ✓ 费用归属自动判定');
  console.log('  ✓ 重复报修合并');
  console.log('  ✓ 幂等性保证');
  console.log('  ✓ 历史记录追踪');
  console.log('  ✓ 报告导出');
  console.log('  ✓ 资产历史分析');
  console.log('  ✓ 维保商绩效评估');

  console.log('\n💡 下一步操作:');
  console.log('  npm start              启动 API 服务');
  console.log('  npm run demo-failure   运行失败场景演示');
  console.log('');
};

runDemo().catch(console.error);
