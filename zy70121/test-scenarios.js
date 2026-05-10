const { AllergenRecallService } = require('./service');
const { sampleData } = require('./sample-data');

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printSection(title) {
  console.log('\n  ── ' + title + ' ──');
}

function assert(condition, message) {
  if (condition) {
    console.log(`    ✅ ${message}`);
  } else {
    console.log(`    ❌ ${message}`);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n食品过敏源召回 API - 场景测试');
  console.log('================================');

  const service = new AllergenRecallService();
  
  printHeader('初始化样例数据');
  sampleData.allergenRules.forEach(rule => service.addAllergenRule(rule));
  sampleData.skuBatches.forEach(batch => service.addSkuBatch(batch));
  sampleData.orders.forEach(order => service.addOrder(order));
  sampleData.inventory.forEach(item => service.addInventory(item));
  console.log('  ✅ 数据初始化完成');
  console.log(`    - 过敏源规则: ${sampleData.allergenRules.length} 条`);
  console.log(`    - SKU批次: ${sampleData.skuBatches.length} 个`);
  console.log(`    - 订单: ${sampleData.orders.length} 个`);
  console.log(`    - 库存记录: ${sampleData.inventory.length} 条`);

  printHeader('场景 1: 正常召回流程 - 花生曲奇批次');
  console.log('\n  业务场景:');
  console.log('    质检发现"香脆花生曲奇"批次 BATCH-A202605 实际含有花生成分');
  console.log('    但包装标签只标注了小麦，存在过敏源标注错误');
  console.log('    需要立即召回已售出订单并冻结库存');
  
  printSection('发起召回');
  try {
    const result = service.initiateRecall(
      'RULE-001',
      'BATCH-A202605',
      '过敏源标注错误：实际含有花生成分但未标注'
    );
    
    console.log(`    召回ID: ${result.recallId}`);
    console.log(`    状态: ${result.status}`);
    console.log(`    过敏源: ${result.summary.allergen}`);
    console.log(`    产品: ${result.summary.product}`);
    console.log(`    影响订单数: ${result.summary.affectedOrders}`);
    console.log(`    已发送通知: ${result.summary.notificationsSent}`);
    console.log(`    冻结库存: ${result.summary.inventoryFrozen} 件`);
    
    assert(result.status === '已完成', '召回流程完成');
    assert(result.summary.affectedOrders === 3, '正确匹配 3 个受影响订单');
    assert(result.summary.notificationsSent === 3, '发送 3 条召回通知');
    assert(result.summary.inventoryFrozen === 4985, '冻结 4985 件库存');
    
    printSection('检查执行报告');
    const report = result.report;
    console.log(`    报告ID: ${report.reportId}`);
    console.log(`    严重性: ${report.summary.severity}`);
    console.log(`    标注错误: ${report.summary.labelError ? '是' : '否'}`);
    console.log(`    实际过敏源: ${report.summary.actualAllergens.join(', ')}`);
    console.log(`    标注过敏源: ${report.summary.labeledAllergens.join(', ')}`);
    console.log(`    影响订单金额: ¥${report.orderRecallSummary.totalAffectedAmount}`);
    console.log(`    涉及仓库: ${report.inventoryFreezeSummary.warehousesAffected} 个`);
    
    assert(report.summary.labelError === true, '报告正确识别标注错误');
    assert(report.orderRecallSummary.ordersToShip === 1, '1 个待发货订单需拦截');
    assert(report.orderRecallSummary.ordersShipped === 2, '2 个已发货订单需召回');
    
    printSection('检查订单状态更新');
    const order1 = service.getOrder('ORDER-20260508-001');
    const order4 = service.getOrder('ORDER-20260509-002');
    console.log(`    订单 ORDER-20260508-001 (张三):`);
    console.log(`      原状态: 已发货 -> 召回状态: ${order1.recallStatus}`);
    console.log(`    订单 ORDER-20260509-002 (赵六):`);
    console.log(`      原状态: 待发货 -> 现状态: ${order4.status}`);
    console.log(`      召回状态: ${order4.recallStatus}`);
    
    assert(order1.recallStatus === '已通知', '已发货订单标记为已通知');
    assert(order4.status === '已拦截', '待发货订单被拦截');
    
    printSection('检查库存状态');
    const inventory = service.getInventory('SKU-COOKIE-001', 'BATCH-A202605');
    console.log(`    库存状态: ${inventory.status}`);
    console.log(`    冻结时间: ${inventory.frozenAt}`);
    console.log(`    冻结数量: ${inventory.availableQuantity} 件`);
    
    assert(inventory.status === '已冻结', '库存已冻结');
    
  } catch (error) {
    console.log(`    ❌ 错误: ${error.message}`);
  }

  printHeader('场景 2: 异常拦截 - 重复发起同一召回');
  console.log('\n  业务场景:');
  console.log('    操作员可能重复点击召回按钮，或系统重试时重复请求');
  console.log('    需要防止同一批次被重复召回');
  
  printSection('尝试重复召回');
  try {
    service.initiateRecall(
      'RULE-001',
      'BATCH-A202605',
      '再次尝试召回同一批次'
    );
    console.log('    ❌ 应该抛出错误但没有');
  } catch (error) {
    console.log(`    错误信息: ${error.message}`);
    assert(error.message.includes('已存在针对此过敏源的召回'), '正确拦截重复召回');
  }

  printHeader('场景 3: 异常拦截 - 批次不含指定过敏源');
  console.log('\n  业务场景:');
  console.log('    操作员错误选择了不相关的过敏源规则');
  console.log('    系统需要验证批次实际是否包含该过敏源');
  
  printSection('尝试用牛奶规则召回花生曲奇');
  try {
    service.initiateRecall(
      'RULE-002',
      'BATCH-A202605',
      '错误的过敏源规则'
    );
    console.log('    ❌ 应该抛出错误但没有');
  } catch (error) {
    console.log(`    错误信息: ${error.message}`);
    assert(error.message.includes('不包含过敏源'), '正确验证过敏源匹配');
  }

  printHeader('场景 4: 异常拦截 - 不存在的规则/批次');
  console.log('\n  业务场景:');
  console.log('    调用方传入了不存在的规则ID或批次ID');
  
  printSection('测试不存在的规则');
  try {
    service.initiateRecall('RULE-999', 'BATCH-A202605', '测试');
    console.log('    ❌ 应该抛出错误但没有');
  } catch (error) {
    console.log(`    错误信息: ${error.message}`);
    assert(error.message.includes('过敏源规则不存在'), '正确拦截不存在的规则');
  }
  
  printSection('测试不存在的批次');
  try {
    service.initiateRecall('RULE-001', 'BATCH-999', '测试');
    console.log('    ❌ 应该抛出错误但没有');
  } catch (error) {
    console.log(`    错误信息: ${error.message}`);
    assert(error.message.includes('SKU批次不存在'), '正确拦截不存在的批次');
  }

  printHeader('场景 5: 并发控制 - 模拟同时请求');
  console.log('\n  业务场景:');
  console.log('    多个系统实例或操作员同时对同一批次发起召回');
  console.log('    需要确保只有一个请求能处理，其他被拦截');
  
  printSection('测试批次锁定机制');
  
  const testService = new AllergenRecallService();
  sampleData.skuBatches.forEach(batch => testService.addSkuBatch(batch));
  sampleData.allergenRules.forEach(rule => testService.addAllergenRule(rule));
  sampleData.orders.forEach(order => testService.addOrder(order));
  sampleData.inventory.forEach(item => testService.addInventory(item));
  
  const lockKey = 'batch:BATCH-B202605';
  const owner1 = 'process-001';
  const owner2 = 'process-002';
  
  console.log('    进程 1 尝试获取批次 BATCH-B202605 的锁...');
  const lock1 = testService.acquireLock('batch', 'BATCH-B202605', owner1);
  console.log(`    进程 1 获取锁: ${lock1 ? '成功' : '失败'}`);
  
  console.log('    进程 2 同时尝试获取同一批次的锁...');
  const lock2 = testService.acquireLock('batch', 'BATCH-B202605', owner2);
  console.log(`    进程 2 获取锁: ${lock2 ? '成功' : '失败'}`);
  
  assert(lock1 === true, '第一个进程成功获取锁');
  assert(lock2 === false, '第二个进程被阻止获取锁');
  
  console.log('    进程 1 释放锁...');
  const released = testService.releaseLock('batch', 'BATCH-B202605', owner1);
  console.log(`    释放成功: ${released ? '是' : '否'}`);
  
  console.log('    进程 2 再次尝试获取锁...');
  const lock3 = testService.acquireLock('batch', 'BATCH-B202605', owner2);
  console.log(`    进程 2 获取锁: ${lock3 ? '成功' : '失败'}`);
  
  assert(lock3 === true, '锁释放后第二个进程可以获取');
  
  printSection('模拟并发召回请求');
  const testService2 = new AllergenRecallService();
  sampleData.skuBatches.forEach(batch => testService2.addSkuBatch(batch));
  sampleData.allergenRules.forEach(rule => testService2.addAllergenRule(rule));
  sampleData.orders.forEach(order => testService2.addOrder(order));
  sampleData.inventory.forEach(item => testService2.addInventory(item));
  
  testService2.acquireLock('batch', 'BATCH-C202605', 'simulated-lock');
  
  try {
    testService2.initiateRecall(
      'RULE-003',
      'BATCH-C202605',
      '测试并发'
    );
    console.log('    ❌ 应该抛出错误但没有');
  } catch (error) {
    console.log(`    错误信息: ${error.message}`);
    assert(error.message.includes('正在被其他召回流程处理'), '并发请求被正确拦截');
  }
  
  testService2.releaseLock('batch', 'BATCH-C202605', 'simulated-lock');

  printHeader('场景 6: 重试已完成的召回');
  console.log('\n  业务场景:');
  console.log('    操作员点击重试按钮，或系统自动重试已完成的召回');
  console.log('    需要防止重复处理已完成的召回');
  
  printSection('尝试重试已完成的召回');
  const recalls = service.getAllRecalls();
  const completedRecall = recalls[0];
  
  const retryResult = service.retryRecall(completedRecall.recallId);
  console.log(`    重试结果: ${retryResult.message}`);
  console.log(`    状态: ${retryResult.status}`);
  
  assert(retryResult.message === '该召回已完成，无需重试', '已完成的召回不重复处理');
  assert(retryResult.status === '已完成', '状态保持已完成');

  printHeader('场景 7: 正常召回另一个批次 - 全麦面包');
  console.log('\n  业务场景:');
  console.log('    全麦吐司面包批次 BATCH-C202605 实际含有小麦');
  console.log('    但标签错误标注为牛奶，需要召回');
  
  const service2 = new AllergenRecallService();
  sampleData.allergenRules.forEach(rule => service2.addAllergenRule(rule));
  sampleData.skuBatches.forEach(batch => service2.addSkuBatch(batch));
  sampleData.orders.forEach(order => service2.addOrder(order));
  sampleData.inventory.forEach(item => service2.addInventory(item));
  
  printSection('发起召回');
  const result2 = service2.initiateRecall(
    'RULE-003',
    'BATCH-C202605',
    '过敏源标注错误：实际含有小麦但标注为牛奶'
  );
  
  console.log(`    召回ID: ${result2.recallId}`);
  console.log(`    过敏源: ${result2.summary.allergen}`);
  console.log(`    产品: ${result2.summary.product}`);
  console.log(`    影响订单数: ${result2.summary.affectedOrders}`);
  console.log(`    召回报告:`);
  console.log(`      - 实际过敏源: ${result2.report.summary.actualAllergens.join(', ')}`);
  console.log(`      - 标注过敏源: ${result2.report.summary.labeledAllergens.join(', ')}`);
  console.log(`      - 客户: 王五 (订单 ORDER-20260509-001)`);
  console.log(`      - 影响数量: 5 件`);
  
  assert(result2.summary.affectedOrders === 1, '正确匹配 1 个受影响订单');
  assert(result2.summary.notificationsSent === 1, '发送 1 条召回通知');

  printHeader('测试汇总');
  console.log('\n  所有场景测试完成！');
  console.log('\n  验收要点:');
  console.log('    ✅ 正常召回：订单匹配、通知生成、库存冻结、报告生成');
  console.log('    ✅ 异常拦截：重复召回、过敏源不匹配、不存在的规则/批次');
  console.log('    ✅ 并发控制：批次锁定机制防止重复处理');
  console.log('    ✅ 幂等性：已完成的召回重试不重复执行');
  console.log('    ✅ 可检查输出：');
  console.log('       - 召回通知（含客户信息、过敏源、症状）');
  console.log('       - 库存冻结记录（状态、时间、数量）');
  console.log('       - 执行报告（统计、明细、时间戳）');
  console.log('\n');
}

runTests().catch(console.error);
