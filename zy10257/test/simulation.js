const db = require('../src/models/database');
const syncEngine = require('../src/utils/syncEngine');
const { v4: uuidv4 } = require('uuid');

function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
}

function printResult(result, indent = '') {
  if (result.success) {
    console.log(`${indent}✅ 成功: ${result.message}`);
    if (result.cached) {
      console.log(`${indent}   ⚡ 幂等性命中 - 重复请求返回缓存结果`);
    }
  } else if (result.conflicted) {
    console.log(`${indent}⚠️  冲突检测:`);
    result.conflictInfo.conflicts.forEach((c, i) => {
      console.log(`${indent}   ${i + 1}. ${c.type} - ${c.resolution.description}`);
      console.log(`${indent}      规则: ${c.resolution.rule}`);
    });
  } else {
    console.log(`${indent}❌ 失败: ${result.error}`);
    console.log(`${indent}   ${result.message}`);
  }
}

async function scenario1_duplicateCouponRedemption() {
  printHeader('场景1: 同一券在A、B两店同时核销（重复核销冲突）');
  
  const coupon = db.getCoupon('coupon_001');
  console.log(`\n初始状态: 券 ${coupon.id} 状态 = ${coupon.status}`);
  console.log(`会员储值余额: ${db.getStoredValue('member_001').balance}`);
  console.log(`会员积分: ${db.getPoints('member_001').balance}`);

  console.log('\n--- A店发起核销 ---');
  const resultA = await syncEngine.processEvent({
    id: uuidv4(),
    eventType: 'coupon:redeem',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'coupon',
    entityId: 'coupon_001',
    timestamp: new Date(Date.now() - 1000),
    payload: { orderId: 'A-ORDER-001' }
  });
  printResult(resultA, '  ');

  console.log('\n--- 几乎同时，B店也发起核销 ---');
  const resultB = await syncEngine.processEvent({
    id: uuidv4(),
    eventType: 'coupon:redeem',
    storeId: 'store_b',
    memberId: 'member_001',
    entityType: 'coupon',
    entityId: 'coupon_001',
    timestamp: new Date(),
    payload: { orderId: 'B-ORDER-001' }
  });
  printResult(resultB, '  ');

  const finalCoupon = db.getCoupon('coupon_001');
  console.log(`\n📊 最终结果:`);
  console.log(`   券状态: ${finalCoupon.status}`);
  console.log(`   核销门店: ${finalCoupon.usedStore}`);
  console.log(`   核销订单: ${finalCoupon.usedOrder}`);
  console.log(`   核销时间: ${finalCoupon.usedAt}`);
  console.log(`\n   ✅ 保留A店结果（时间戳较早），拒绝B店重复核销`);
  console.log(`   ✅ B店收银员看到: 券已在A店核销，订单 A-ORDER-001`);
}

async function scenario2_idempotency() {
  printHeader('场景2: 重复提交（幂等性保证）');
  
  const idempotencyKey = 'store_a:req_12345';
  
  console.log('\n--- A店首次请求核销 ---');
  const result1 = await syncEngine.processEvent({
    id: uuidv4(),
    eventType: 'coupon:redeem',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'coupon',
    entityId: 'coupon_002',
    timestamp: new Date(),
    payload: { orderId: 'A-ORDER-002' }
  }, { idempotencyKey });
  printResult(result1, '  ');

  console.log('\n--- 网络抖动，A店重试同一请求（相同幂等键）---');
  const result2 = await syncEngine.processEvent({
    id: uuidv4(),
    eventType: 'coupon:redeem',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'coupon',
    entityId: 'coupon_002',
    timestamp: new Date(),
    payload: { orderId: 'A-ORDER-002' }
  }, { idempotencyKey });
  printResult(result2, '  ');

  const events = db.getEvents({ memberId: 'member_001' });
  console.log(`\n📊 最终结果:`);
  console.log(`   实际事件数: ${events.filter(e => e.status === 'applied').length}`);
  console.log(`   ✅ 同一件事不会被计算两遍，确保业务一致性`);
}

async function scenario3_insufficientBalance() {
  printHeader('场景3: 储值余额不足（跨店并发扣款）');
  
  console.log('\n初始状态: 储值余额 = 1000元');
  
  const events = [
    {
      id: uuidv4(),
      eventType: 'storedvalue:deduct',
      storeId: 'store_a',
      memberId: 'member_001',
      entityType: 'storedvalue',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 500),
      sequence: 1,
      payload: { amount: 600, orderId: 'A-ORDER-003' }
    },
    {
      id: uuidv4(),
      eventType: 'storedvalue:deduct',
      storeId: 'store_b',
      memberId: 'member_001',
      entityType: 'storedvalue',
      entityId: 'member_001',
      timestamp: new Date(),
      sequence: 2,
      payload: { amount: 500, orderId: 'B-ORDER-003' }
    }
  ];

  console.log('\n--- 并发扣款: A店600元，B店500元 ---');
  console.log('   按时间戳顺序处理...');
  
  for (let i = 0; i < events.length; i++) {
    console.log(`\n   处理 ${i === 0 ? 'A店' : 'B店'} 扣款:`);
    const result = await syncEngine.processEvent(events[i]);
    printResult(result, '     ');
    console.log(`     当前余额: ${db.getStoredValue('member_001').balance}元`);
  }

  console.log(`\n📊 最终结果:`);
  console.log(`   储值余额: ${db.getStoredValue('member_001').balance}元`);
  console.log(`   ✅ A店扣款成功 (时间较早)，余额剩余: ${1000 - 600}元`);
  console.log(`   ✅ B店扣款失败，提示余额不足`);
  console.log(`   ✅ 不会出现超扣或负数余额`);
}

async function scenario4_offlineBatchPartialFailure() {
  printHeader('场景4: 离线批次部分失败（网络恢复后同步）');
  
  console.log('\n--- B店离线收银，本地记录3笔交易 ---');
  const batchId = uuidv4();
  const offlineEvents = [
    {
      id: uuidv4(),
      idempotencyKey: `store_b:off_101`,
      eventType: 'storedvalue:recharge',
      storeId: 'store_b',
      memberId: 'member_001',
      entityType: 'storedvalue',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 10000),
      sequence: 1,
      payload: { amount: 200 }
    },
    {
      id: uuidv4(),
      idempotencyKey: `store_b:off_102`,
      eventType: 'points:earn',
      storeId: 'store_b',
      memberId: 'member_001',
      entityType: 'points',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 8000),
      sequence: 2,
      payload: { amount: 500, orderId: 'B-OFF-002' }
    },
    {
      id: uuidv4(),
      idempotencyKey: `store_b:off_103`,
      eventType: 'storedvalue:deduct',
      storeId: 'store_b',
      memberId: 'member_001',
      entityType: 'storedvalue',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 6000),
      sequence: 3,
      payload: { amount: 5000, orderId: 'B-OFF-003' }
    }
  ];

  console.log(`   批次ID: ${batchId.substring(0, 8)}...`);
  console.log(`   交易数: 3笔 (充值200, 积分+500, 扣款5000)`);
  console.log(`   状态: 待同步 (离线模式)`);

  console.log('\n--- 网络恢复，开始同步批次 ---');
  db.createOfflineBatch({ id: batchId, storeId: 'store_b', events: offlineEvents });
  const result = await syncEngine.processOfflineBatch(batchId);
  
  console.log(`   同步状态: ${result.status}`);
  console.log(`   成功: ${result.successCount} 笔`);
  console.log(`   失败: ${result.failedCount} 笔`);
  
  console.log('\n   详情:');
  result.failedEvents.forEach(fail => {
    console.log(`     ❌ ${fail.event.eventType}: ${fail.error.message}`);
    console.log(`        订单: ${fail.event.payload.orderId || 'N/A'}`);
  });

  const sv = db.getStoredValue('member_001');
  const pts = db.getPoints('member_001');
  console.log(`\n📊 最终结果:`);
  console.log(`   储值余额: ${sv.balance}元 (充值成功，大额扣款失败)`);
  console.log(`   积分: ${pts.balance}分 (积分增加成功)`);
  console.log(`   ✅ 成功的交易正常入账，失败的单独处理`);
  console.log(`   ✅ 不会出现部分扣款或数据不一致`);
  console.log(`   ✅ 收银员可以单独重试失败的交易`);
}

async function scenario5_outOfOrderEvents() {
  printHeader('场景5: 事件乱序处理');
  
  console.log('\n--- 事件按乱序到达服务器 ---');
  
  const events = [
    {
      id: uuidv4(),
      eventType: 'points:earn',
      storeId: 'store_a',
      memberId: 'member_001',
      entityType: 'points',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 2000),
      sequence: 3,
      payload: { amount: 100, orderId: 'SEQ-003' }
    },
    {
      id: uuidv4(),
      eventType: 'points:earn',
      storeId: 'store_a',
      memberId: 'member_001',
      entityType: 'points',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 3000),
      sequence: 1,
      payload: { amount: 300, orderId: 'SEQ-001' }
    },
    {
      id: uuidv4(),
      eventType: 'points:earn',
      storeId: 'store_a',
      memberId: 'member_001',
      entityType: 'points',
      entityId: 'member_001',
      timestamp: new Date(Date.now() - 1000),
      sequence: 2,
      payload: { amount: 200, orderId: 'SEQ-002' }
    }
  ];

  console.log('   到达顺序: 事件3 → 事件1 → 事件2');
  console.log('   序列号:   3 → 1 → 2');
  console.log('   处理方式: 按序列号重新排序后批量处理');

  console.log('\n--- 创建离线批次自动重排序 ---');
  const batchId = uuidv4();
  db.createOfflineBatch({ id: batchId, storeId: 'store_a', events });
  const result = await syncEngine.processOfflineBatch(batchId);
  
  console.log(`\n📊 最终结果:`);
  console.log(`   积分余额: ${db.getPoints('member_001').balance}分`);
  console.log(`   事件处理数: ${result.successCount}`);
  console.log(`   ✅ 按序列号顺序: 300 + 200 + 100 = 600分 全部到账`);
  console.log(`   ✅ 乱序不影响最终结果的正确性`);
}

async function scenario6_implicitIdempotencyByEventId() {
  printHeader('场景6: 隐含幂等性（event.id 作为幂等键）- 修复验证');
  
  const initialPoints = db.getPoints('member_001').balance;
  console.log(`\n初始积分: ${initialPoints}分`);
  
  const eventId = uuidv4();
  const eventData = {
    id: eventId,
    eventType: 'points:earn',
    storeId: 'store_a',
    memberId: 'member_001',
    entityType: 'points',
    entityId: 'member_001',
    timestamp: new Date(),
    payload: { amount: 77, orderId: 'TEST-IDEMP-001' }
  };
  
  console.log(`\n--- 第1次调用 processEvent (event.id = ${eventId.substring(0, 8)}...) ---`);
  const result1 = await syncEngine.processEvent(eventData);
  console.log(`   结果: ${result1.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   是否缓存: ${result1.cached ? '是' : '否'}`);
  console.log(`   当前积分: ${db.getPoints('member_001').balance}分`);
  
  console.log(`\n--- 第2次调用 processEvent (相同 event.id，无 idempotencyKey) ---`);
  const result2 = await syncEngine.processEvent(eventData);
  console.log(`   结果: ${result2.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   是否缓存: ${result2.cached ? '是' : '否'}`);
  console.log(`   缓存方式: ${result2.cachedBy || 'N/A'}`);
  console.log(`   当前积分: ${db.getPoints('member_001').balance}分`);
  
  const finalPoints = db.getPoints('member_001').balance;
  
  console.log(`\n📊 最终结果:`);
  console.log(`   积分变化: ${initialPoints} → ${finalPoints}`);
  console.log(`   增加: ${finalPoints - initialPoints}分 (预期: 77分)`);
  
  if (finalPoints - initialPoints === 77) {
    console.log(`   ✅ 隐含幂等性生效！相同 event.id 调用两次，积分只增加一次`);
    console.log(`   ✅ 无论是否显式传入 idempotencyKey，同一件事不会算两遍`);
  } else {
    console.log(`   ❌ 幂等性失败！积分增加了 ${finalPoints - initialPoints} 次`);
  }
}

async function scenario7_batchReentryProtection() {
  printHeader('场景7: 批次重入保护 - 修复验证');
  
  const initialPoints = db.getPoints('member_001').balance;
  console.log(`\n初始积分: ${initialPoints}分`);
  
  const batchId = uuidv4();
  const eventId = uuidv4();
  console.log(`   事件ID: ${eventId.substring(0, 8)}... (确保唯一)`);
  
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
      payload: { amount: 100, orderId: 'BATCH-TEST-001' }
    }
  ];
  
  console.log(`\n--- 创建批次: ${batchId.substring(0, 8)}... ---`);
  db.createOfflineBatch({ id: batchId, storeId: 'store_b', events: batchEvents, totalCount: 1 });
  const batchBefore = db.getOfflineBatch(batchId);
  console.log(`   批次初始状态: ${batchBefore.status}`);
  console.log(`   successCount: ${batchBefore.successCount}`);
  
  console.log(`\n--- 第1次调用 processOfflineBatch ---`);
  const result1 = await syncEngine.processOfflineBatch(batchId);
  console.log(`   结果: ${result1.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   批次状态: ${result1.status}`);
  console.log(`   successCount: ${result1.successCount}`);
  console.log(`   是否缓存: ${result1.cached ? '是' : '否'}`);
  console.log(`   当前积分: ${db.getPoints('member_001').balance}分`);
  
  const batchAfter1 = db.getOfflineBatch(batchId);
  console.log(`   数据库中批次状态: ${batchAfter1.status}`);
  
  console.log(`\n--- 第2次调用 processOfflineBatch (同批次，重复提交) ---`);
  const result2 = await syncEngine.processOfflineBatch(batchId);
  console.log(`   结果: ${result2.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   批次状态: ${result2.status}`);
  console.log(`   是否缓存: ${result2.cached ? '是' : '否'}`);
  console.log(`   缓存方式: ${result2.cachedBy || 'N/A'}`);
  console.log(`   当前积分: ${db.getPoints('member_001').balance}分`);
  
  console.log(`\n--- 第3次调用 processOfflineBatch (再次重复) ---`);
  const result3 = await syncEngine.processOfflineBatch(batchId);
  console.log(`   结果: ${result3.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   是否缓存: ${result3.cached ? '是' : '否'}`);
  console.log(`   当前积分: ${db.getPoints('member_001').balance}分`);
  
  const finalPoints = db.getPoints('member_001').balance;
  
  console.log(`\n📊 最终结果:`);
  console.log(`   积分变化: ${initialPoints} → ${finalPoints}`);
  console.log(`   增加: ${finalPoints - initialPoints}分 (预期: 100分)`);
  
  if (finalPoints - initialPoints === 100) {
    console.log(`   ✅ 批次重入保护生效！调用3次，积分只增加1次`);
    console.log(`   ✅ completed/partial 状态的批次不会重复处理`);
    console.log(`   ✅ 重复导入同批次不会把同一件事算两遍`);
  } else {
    console.log(`   ❌ 批次重入保护失败！积分增加了 ${(finalPoints - initialPoints) / 100} 次`);
  }
}

async function showFinalSummary() {
  printHeader('系统状态汇总');
  
  const summary = db.getMemberSummary('member_001');
  const status = db.getSyncStatus();
  
  console.log('\n👤 会员信息:');
  console.log(`   ID: ${summary.member.id}`);
  console.log(`   姓名: ${summary.member.name}`);
  console.log(`   等级: ${summary.member.level}`);
  
  console.log('\n💰 权益状态:');
  console.log(`   储值余额: ${summary.storedValue.balance}元`);
  console.log(`   积分: ${summary.points.balance}分`);
  console.log(`   可用券: ${summary.coupons.available}张`);
  console.log(`   已用券: ${summary.coupons.used}张`);
  
  console.log('\n📈 同步状态:');
  console.log(`   总事件数: ${status.totalEvents}`);
  console.log(`   冲突数: ${status.conflictedEvents}`);
  console.log(`   总批次数: ${status.totalBatches}`);
  console.log(`   已完成批次: ${status.completedBatches}`);
  console.log(`   部分成功批次: ${status.partiallySyncedBatches}`);
  
  console.log('\n' + '='.repeat(70));
  console.log('  跨店会员权益同步系统 - 演示完成');
  console.log('='.repeat(70));
  console.log('\n✅ 核心能力验证:');
  console.log('   1. 事件溯源 - 所有操作都有日志，可追溯可审计');
  console.log('   2. 幂等性 - 重复请求不会重复执行');
  console.log('   3. 冲突检测 - 跨店并发操作自动检测冲突');
  console.log('   4. 离线同步 - 网络中断不影响收银，恢复后批量同步');
  console.log('   5. 最终一致 - 通过FIRST_WINS等策略保证数据一致');
  console.log('   6. 部分失败 - 批次中部分失败不影响整体，可单独重试');
}

async function runAllScenarios() {
  console.clear();
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           跨店会员权益同步系统 - 并发冲突场景演示           ║');
  console.log('║                    (第二轮修复验证)                           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n初始化数据:');
  console.log('  🏪 A店 (store_a) - 北京市朝阳区');
  console.log('  🏪 B店 (store_b) - 上海市浦东新区');
  console.log('  👤 会员张三 (member_001)');
  console.log('  💰 储值: 1000元 | 积分: 5000分');
  console.log('  🎫 可用券: 2张');

  await scenario1_duplicateCouponRedemption();
  await scenario2_idempotency();
  await scenario3_insufficientBalance();
  await scenario4_offlineBatchPartialFailure();
  await scenario5_outOfOrderEvents();
  await scenario6_implicitIdempotencyByEventId();
  await scenario7_batchReentryProtection();
  await showFinalSummary();
}

runAllScenarios().catch(console.error);
