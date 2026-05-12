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

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║        跨店会员权益同步 - 第二轮修复验证             ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const test1Pass = await testImplicitIdempotency();
  const test2Pass = await testBatchReentry();
  
  console.log('\n\n' + '='.repeat(60));
  console.log('测试结果汇总:');
  console.log(`  测试1 (隐含幂等性): ${test1Pass ? '✅ 通过' : '❌ 失败'}`);
  console.log(`  测试2 (批次重入保护): ${test2Pass ? '✅ 通过' : '❌ 失败'}`);
  console.log('='.repeat(60));
  
  if (test1Pass && test2Pass) {
    console.log('\n🎉 所有修复验证通过！');
    console.log('   ✅ 相同 event.id 重复调用，积分只增加一次');
    console.log('   ✅ completed/partial 状态批次不会重复处理');
    console.log('   ✅ 重复导入同批次不会把同一件事算两遍');
  } else {
    console.log('\n⚠️  部分修复需要调整');
  }
}

runTests().catch(console.error);
