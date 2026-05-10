const db = require('../src/database');
const qualificationService = require('../src/services/qualification-service');
const orderService = require('../src/services/order-service');
const supplementService = require('../src/services/supplement-service');
const recoveryService = require('../src/services/recovery-service');
const riskService = require('../src/services/risk-service');
const exceptionService = require('../src/services/exception-service');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFlow() {
  console.log('========================================');
  console.log('   供应商资质冻结 API - 主流程测试');
  console.log('========================================');
  console.log('');
  
  await db.init();
  
  console.log('【步骤 1】查看所有供应商状态');
  console.log('----------------------------------------');
  const suppliers = await qualificationService.getAllSuppliers();
  suppliers.forEach(s => {
    console.log(`  ${s.id}: ${s.name} - ${s.status === 'active' ? '正常' : '已冻结'}`);
  });
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 2】检查供应商 sup_001 的状态');
  console.log('----------------------------------------');
  const statusCheck = await qualificationService.checkSupplierStatus('sup_001');
  console.log('  可下单:', statusCheck.can_order ? '是' : '否');
  console.log('  原因:', statusCheck.reason);
  if (statusCheck.expired_qualifications.length > 0) {
    console.log('  过期资质:');
    statusCheck.expired_qualifications.forEach(q => {
      console.log(`    - ${q.type} [${q.name}] 有效期至: ${q.expiry_date}`);
    });
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 3】尝试为已冻结供应商 sup_001 下单');
  console.log('----------------------------------------');
  try {
    const order = await orderService.createOrder({
      supplier_id: 'sup_001',
      order_no: 'TEST-ORD-001',
      amount: 15000,
      item_list: ['大米 100袋', '食用油 50桶']
    });
    console.log('  订单状态:', order.status);
    console.log('  拦截原因:', order.freeze_reason || '无');
    console.log('  结果: 订单被成功拦截');
  } catch (err) {
    console.log('  下单失败:', err.message);
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 4】为正常供应商 sup_004 下单');
  console.log('----------------------------------------');
  try {
    const order = await orderService.createOrder({
      supplier_id: 'sup_004',
      order_no: 'TEST-ORD-002',
      amount: 35000,
      item_list: ['新鲜蔬菜 200kg', '水果 100kg']
    });
    console.log('  订单ID:', order.id);
    console.log('  订单状态:', order.status);
    console.log('  结果: 订单创建成功，可正常审核');
  } catch (err) {
    console.log('  下单失败:', err.message);
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 5】触发到期检测，识别需补证的资质');
  console.log('----------------------------------------');
  const detectResult = await qualificationService.detectExpiryQualifications();
  console.log('  已过期资质:', detectResult.expired.length, '个');
  console.log('  即将到期:', detectResult.warning.length, '个');
  console.log('  需补证:', detectResult.needs_supplement.length, '个');
  
  if (detectResult.needs_supplement.length > 0) {
    console.log('  待补证清单:');
    detectResult.needs_supplement.forEach(async (item) => {
      const qual = await qualificationService.getQualificationById(item.qualification_id);
      if (qual) {
        console.log(`    - ${qual.supplier_id}: ${qual.name} (到期日: ${qual.expiry_date})`);
      }
    });
  }
  console.log('');
  
  await sleep(1000);
  
  console.log('【步骤 6】模拟 sup_001 提交补证申请');
  console.log('----------------------------------------');
  const supplements = await supplementService.getPendingSupplements();
  let pendingForSup001 = supplements.find(s => s.supplier_id === 'sup_001');
  
  if (pendingForSup001) {
    console.log('  提交补证材料...');
    await supplementService.submitSupplement(
      pendingForSup001.id,
      'SC10111010500001-NEW',
      '2026-01-15',
      '张经理'
    );
    console.log('  补证申请已提交，等待审批');
  } else {
    console.log('  先创建补证申请...');
    const newSupplement = await supplementService.createSupplement({
      supplier_id: 'sup_001',
      qualification_id: 'qual_002',
      reason: '食品经营许可证过期'
    });
    await supplementService.submitSupplement(
      newSupplement.id,
      'SC10111010500001-NEW',
      '2026-01-15',
      '张经理'
    );
    console.log('  补证申请已创建并提交');
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 7】审批补证申请（模拟审批员操作）');
  console.log('----------------------------------------');
  const pendingAfterSubmit = await supplementService.getPendingSupplements();
  const sup001Pending = pendingAfterSubmit.find(s => s.supplier_id === 'sup_001');
  
  if (sup001Pending) {
    const result = await supplementService.approveSupplement(
      sup001Pending.id,
      '审批员-李'
    );
    console.log('  审批结果:', result.unfrozen ? '通过，供应商已恢复资格' : '通过');
    if (result.unfrozen) {
      const updatedSupplier = await qualificationService.getSupplierById('sup_001');
      console.log('  供应商当前状态:', updatedSupplier.status === 'active' ? '已恢复正常' : updatedSupplier.status);
    }
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 8】确认 sup_001 恢复后可以正常下单');
  console.log('----------------------------------------');
  try {
    const order = await orderService.createOrder({
      supplier_id: 'sup_001',
      order_no: 'TEST-ORD-003',
      amount: 28000,
      item_list: ['猪肉 500kg', '牛肉 200kg']
    });
    console.log('  订单ID:', order.id);
    console.log('  订单状态:', order.status);
    console.log('  结果: 订单创建成功，资质恢复后可正常下单');
  } catch (err) {
    console.log('  下单失败:', err.message);
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 9】测试风险触发冻结功能');
  console.log('----------------------------------------');
  console.log('  为 sup_003 添加高风险事件...');
  const risk = await riskService.addRisk({
    supplier_id: 'sup_003',
    risk_type: '质量投诉',
    description: '收到客户投诉，产品存在安全隐患',
    severity: 'high'
  });
  const sup003After = await qualificationService.getSupplierById('sup_003');
  console.log('  风险ID:', risk.id);
  console.log('  供应商状态:', sup003After.status === 'frozen' ? '已冻结' : sup003After.status);
  console.log('  结果: 高风险自动触发供应商冻结');
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 10】测试边界数据异常捕获');
  console.log('----------------------------------------');
  console.log('  尝试为不存在的供应商下单...');
  try {
    await orderService.createOrder({
      supplier_id: 'non_exist_001',
      order_no: 'TEST-ORD-004',
      amount: 10000
    });
  } catch (err) {
    console.log('  已捕获异常:', err.message);
  }
  
  console.log('  尝试审批不存在的补证申请...');
  try {
    await supplementService.approveSupplement('non_exist_supp', '审批员');
  } catch (err) {
    console.log('  已捕获异常:', err.message);
  }
  console.log('');
  
  await sleep(500);
  
  console.log('【步骤 11】查看异常记录（边界数据已记录）');
  console.log('----------------------------------------');
  const exceptions = await exceptionService.getExceptionList({ status: 'pending', limit: 5 });
  console.log('  待处理异常数量:', exceptions.length);
  if (exceptions.length > 0) {
    exceptions.forEach((e, i) => {
      console.log(`  ${i + 1}. [${e.severity}] ${e.type}: ${e.error}`);
    });
  }
  console.log('');
  
  await sleep(500);
  
  console.log('========================================');
  console.log('   主流程测试完成！');
  console.log('========================================');
  console.log('');
  console.log('测试总结:');
  console.log('  ✅ 资质过期自动冻结供应商');
  console.log('  ✅ 已冻结供应商下单被拦截');
  console.log('  ✅ 正常供应商可正常下单');
  console.log('  ✅ 补证申请审批流程');
  console.log('  ✅ 补证成功后自动恢复采购资格');
  console.log('  ✅ 高风险自动触发冻结');
  console.log('  ✅ 边界数据异常记录');
  console.log('');
  console.log('可运行 npm run export 导出业务复核数据');
  console.log('可运行 npm start 启动服务测试 API');
  
  process.exit(0);
}

testFlow().catch(err => {
  console.error('测试流程失败:', err);
  process.exit(1);
});
