const db = require('../src/models/database');
const syncEngine = require('../src/utils/syncEngine');
const { v4: uuidv4 } = require('uuid');

async function testImplicitIdempotency() {
  console.log('=== 测试1: 隐含幂等性 (event.id 作为幂等键) ===\n');
  
  const initialPoints = db.getPoints('member_001').balance;
  console.log(`初始积分: ${initialPoints}`);
  
  const eventId = uuidv4();
  const eventData = {
    id: eventId,
    eventType: 'points:earn',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'points',
    entityId: 'member_001',
    timestamp: new Date(),
    payload: { amount: 77, orderId: 'FIX-TEST-001' }
  };
  
  console.log(`\n第1次调用 (event.id: ${eventId.substring(0, 8)}...)`);
  const result1 = await syncEngine.processEvent(eventData);
  console.log(`  成功: ${result1.success}, 缓存: ${result1.cached ? '是' : '否'}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  console.log(`\n第2次调用 (相同 event.id，无 idempotencyKey)`);
  const result2 = await syncEngine.processEvent(eventData);
  console.log(`  成功: ${result2.success}, 缓存: ${result2.cached ? '是' : '否'}`);
  console.log(`  缓存方式: ${result2.cachedBy || 'N/A'}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  const finalPoints = db.getPoints('member_001').balance;
  const delta = finalPoints - initialPoints;
  
  console.log(`\n积分变化: ${initialPoints} → ${finalPoints} = +${delta}`);
  console.log(`预期: +77, 实际: +${delta}`);
  
  if (delta === 77) {
    console.log('✅ 隐含幂等性修复生效！');
  } else {
    console.log('❌ 隐含幂等性修复失败');
  }
  
  return delta === 77;
}

async function testBatchReentry() {
  console.log('\n\n=== 测试2: 批次重入保护 ===\n');
  
  const initialPoints = db.getPoints('member_001').balance;
  console.log(`初始积分: ${initialPoints}`);
  
  const batchId = uuidv4();
  const eventId = uuidv4();
  const batchEvents = [
    {
      id: eventId,
      eventType: 'points:earn',
      storeId: 'store_b',
      memberId: 'member_001',
      entityType: 'points',
      entityId: 'member_001',
      timestamp: new Date(),
      sequence: 1,
      payload: { amount: 100, orderId: 'FIX-TEST-BATCH-001' }
    }
  ];
  
  console.log(`创建批次: ${batchId.substring(0, 8)}...`);
  db.createOfflineBatch({ id: batchId, storeId: 'store_b', events: batchEvents, totalCount: 1 });
  
  const batchBefore = db.getOfflineBatch(batchId);
  console.log(`批次初始状态: ${batchBefore.status}, successCount: ${batchBefore.successCount}`);
  
  console.log(`\n第1次调用 processOfflineBatch`);
  const result1 = await syncEngine.processOfflineBatch(batchId);
  console.log(`  成功: ${result1.success}`);
  console.log(`  批次状态: ${result1.status}`);
  console.log(`  successCount: ${result1.successCount}`);
  console.log(`  failedCount: ${result1.failedCount}`);
  console.log(`  缓存: ${result1.cached ? '是' : '否'}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  if (result1.results && result1.results.length > 0) {
    console.log(`  事件处理详情:`);
    result1.results.forEach((r, i) => {
      console.log(`    事件${i+1}: success=${r.success}, cached=${r.cached}, error=${r.error || 'none'}`);
      if (r.conflicted) {
        console.log(`      冲突类型: ${r.conflictInfo?.conflicts?.[0]?.type}`);
        console.log(`      现有事件ID: ${r.conflictInfo?.conflicts?.[0]?.existingEvent}`);
        console.log(`      现有事件门店: ${r.conflictInfo?.conflicts?.[0]?.existingStore}`);
      }
    });
  }
  
  const batchAfter1 = db.getOfflineBatch(batchId);
  console.log(`  数据库批次状态: ${batchAfter1.status}`);
  
  console.log(`\n第2次调用 processOfflineBatch (重复提交)`);
  const result2 = await syncEngine.processOfflineBatch(batchId);
  console.log(`  成功: ${result2.success}`);
  console.log(`  批次状态: ${result2.status}`);
  console.log(`  缓存: ${result2.cached ? '是' : '否'}`);
  console.log(`  缓存方式: ${result2.cachedBy || 'N/A'}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  console.log(`\n第3次调用 processOfflineBatch (再次重复)`);
  const result3 = await syncEngine.processOfflineBatch(batchId);
  console.log(`  成功: ${result3.success}`);
  console.log(`  缓存: ${result3.cached ? '是' : '否'}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  const finalPoints = db.getPoints('member_001').balance;
  const delta = finalPoints - initialPoints;
  
  console.log(`\n积分变化: ${initialPoints} → ${finalPoints} = +${delta}`);
  console.log(`预期: +100, 实际: +${delta}`);
  
  if (delta === 100) {
    console.log('✅ 批次重入保护修复生效！调用3次积分只增加1次');
  } else {
    console.log('❌ 批次重入保护修复失败');
  }
  
  return delta === 100;
}

async function testBatchImportIdempotency() {
  console.log('\n\n=== 测试3: 真实批次导入幂等性 (相同 batchId 重复导入) ===\n');
  
  const initialPoints = db.getPoints('member_001').balance;
  console.log(`初始积分: ${initialPoints}`);
  
  const batchId = 'import-batch-2026-001';
  const orderId = 'ORDER-001';
  
  const createEvent1 = {
    id: 'event-unique-id-001',
    eventType: 'points:earn',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'points',
    entityId: 'member_001',
    timestamp: new Date(),
    payload: { amount: 33, orderId }
  };
  
  console.log(`\n第1次导入批次 (batchId: ${batchId}, event.id: ${createEvent1.id})`);
  const batch1 = db.createOfflineBatch({
    id: batchId,
    storeId: 'store_a',
    events: [createEvent1]
  });
  console.log(`  批次已存在: ${batch1._existing ? '是' : '否'}`);
  console.log(`  批次已处理: ${batch1._processed ? '是' : '否'}`);
  
  const result1 = await syncEngine.processOfflineBatch(batch1.id);
  console.log(`  处理结果: success=${result1.success}, status=${result1.status}`);
  console.log(`  successCount: ${result1.successCount}`);
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  const createEvent2 = {
    id: 'event-unique-id-002',
    eventType: 'points:earn',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'points',
    entityId: 'member_001',
    timestamp: new Date(),
    payload: { amount: 33, orderId }
  };
  
  console.log(`\n第2次导入批次 (相同 batchId, 不同 event.id: ${createEvent2.id})`);
  const batch2 = db.createOfflineBatch({
    id: batchId,
    storeId: 'store_a',
    events: [createEvent2]
  });
  console.log(`  批次已存在: ${batch2._existing ? '是' : '否'}`);
  console.log(`  批次已处理: ${batch2._processed ? '是' : '否'}`);
  
  if (batch2._processed) {
    console.log(`  ✅ 检测到已完成批次，直接返回缓存结果`);
  } else {
    console.log(`  ❌ 未检测到批次已处理，可能存在问题`);
    await syncEngine.processOfflineBatch(batch2.id);
  }
  
  console.log(`  当前积分: ${db.getPoints('member_001').balance}`);
  
  const finalPoints = db.getPoints('member_001').balance;
  const delta = finalPoints - initialPoints;
  
  console.log(`\n积分变化: ${initialPoints} → ${finalPoints} = +${delta}`);
  console.log(`预期: +33, 实际: +${delta}`);
  
  if (delta === 33) {
    console.log('✅ 真实批次导入幂等性生效！相同 batchId 重复导入，积分只增加一次');
    console.log('   ✅ 即使 event.id 不同，同一业务批次也不会重复计算');
  } else {
    console.log('❌ 真实批次导入幂等性失败');
  }
  
  return delta === 33;
}

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║        跨店会员权益同步 - 第三轮修复验证             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const test1Pass = await testImplicitIdempotency();
  const test2Pass = await testBatchReentry();
  const test3Pass = await testBatchImportIdempotency();
  
  console.log('\n\n' + '='.repeat(60));
  console.log('测试结果汇总:');
  console.log(`  测试1 (event.id 隐含幂等性): ${test1Pass ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  测试2 (processOfflineBatch 重入保护): ${test2Pass ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  测试3 (真实批次导入幂等性): ${test3Pass ? '✅ 通过' : '❌ 失败'}`);
  console.log('='.repeat(60));
  
  if (test1Pass && test2Pass && test3Pass) {
    console.log('\n🎉 所有第三轮修复验证通过！');
    console.log('   ✅ 相同 event.id 重复调用，积分只增加一次');
    console.log('   ✅ completed/partial 状态批次不会重复处理');
    console.log('   ✅ 相同 batchId 重复导入（即使 event.id 不同），积分只增加一次');
    console.log('   ✅ 重复导入不能把同一件事算两遍 - 原始目标达成！');
  } else {
    console.log('\n⚠️  部分修复需要调整');
  }
}

runTests().catch(console.error);
