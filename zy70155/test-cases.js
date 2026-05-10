const { IdempotentKeyService, KEY_STATUS } = require('./idempotentKey');

function printSection(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}\n`);
}

function printResult(result, description) {
  console.log(`[测试] ${description}`);
  if (result.success) {
    console.log(`  ✓ 成功:`, JSON.stringify(result.data, null, 2));
  } else {
    console.log(`  ✗ 失败:`);
    console.log(`    错误码: ${result.error.code}`);
    console.log(`    错误信息: ${result.error.message}`);
    if (result.error.explanation) {
      console.log(`    解释: ${result.error.explanation}`);
    }
    if (result.error.details) {
      console.log(`    详情:`, JSON.stringify(result.error.details, null, 2));
    }
  }
  console.log();
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  const service = new IdempotentKeyService({
    defaultTTL: 5000,
    maxRetryCount: 3,
    cleanupInterval: 1000
  });
  service.start();

  printSection('测试1: 正常流程 - 登记、处理、完成');
  {
    const key = 'order-001';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      ttl: 30000,
      requestBody: { orderId: '001', amount: 100 },
      description: '创建订单'
    });
    printResult(result, '登记幂等键');

    result = service.startProcessing(key);
    printResult(result, '开始处理');

    result = service.completeProcessing(key, { orderId: '001', status: 'created' });
    printResult(result, '完成处理');

    result = service.getKeyStatus(key);
    printResult(result, '查询最终状态');
  }

  printSection('测试2: 冲突场景 - 重复登记已成功的幂等键');
  {
    const key = 'order-002';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '002', amount: 200 }
    });
    printResult(result, '第一次登记');

    result = service.startProcessing(key);
    result = service.completeProcessing(key, { orderId: '002', status: 'created' });

    result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '002', amount: 200 }
    });
    printResult(result, '第二次登记（冲突）');
  }

  printSection('测试3: 冲突场景 - 处理中的幂等键');
  {
    const key = 'order-003';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '003', amount: 300 }
    });
    printResult(result, '登记幂等键');

    result = service.startProcessing(key);
    printResult(result, '开始处理');

    result = service.startProcessing(key);
    printResult(result, '重复开始处理（冲突）');
  }

  printSection('测试4: 失败与重试流程');
  {
    const key = 'order-004';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '004', amount: 400 }
    });
    printResult(result, '登记幂等键');

    result = service.startProcessing(key);
    
    result = service.failProcessing(key, '数据库连接超时');
    printResult(result, '标记失败（第1次失败）');

    result = service.retryProcessing(key);
    printResult(result, '调度重试（第1次重试）');

    result = service.startProcessing(key);
    result = service.failProcessing(key, '支付网关错误');
    printResult(result, '标记失败（第2次失败）');

    result = service.retryProcessing(key);
    result = service.startProcessing(key);
    result = service.failProcessing(key, '库存不足');
    printResult(result, '标记失败（第3次失败）');

    result = service.retryProcessing(key);
    printResult(result, '调度重试（超过最大次数）');
  }

  printSection('测试5: 撤销流程 - 处理中撤销');
  {
    const key = 'order-005';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '005', amount: 500 }
    });
    printResult(result, '登记幂等键');

    result = service.startProcessing(key);
    printResult(result, '开始处理');

    result = service.revokeKey(key, '用户取消订单');
    printResult(result, '撤销幂等键');

    result = service.getKeyStatus(key);
    printResult(result, '查询撤销后状态');

    result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '005', amount: 500 }
    });
    printResult(result, '重新登记已撤销的键（冲突）');
  }

  printSection('测试6: 撤销后重新执行流程');
  {
    const key = 'order-006';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '006', amount: 600 }
    });
    printResult(result, '第一次登记');

    result = service.startProcessing(key);
    result = service.revokeKey(key, '业务方强制重跑');
    printResult(result, '撤销幂等键');

    result = service.registerKey({
      key: key + '-v2',
      scope: 'order-service',
      requestBody: { orderId: '006', amount: 600 }
    });
    printResult(result, '使用新键重新登记');

    result = service.startProcessing(key + '-v2');
    result = service.completeProcessing(key + '-v2', { orderId: '006', status: 'created' });
    printResult(result, '使用新键完成处理');
  }

  printSection('测试7: 过期回收机制');
  {
    const key = 'order-007';
    
    let result = service.registerKey({
      key,
      scope: 'order-service',
      ttl: 1000,
      requestBody: { orderId: '007', amount: 700 }
    });
    printResult(result, '登记短TTL幂等键（1秒）');

    console.log('等待2秒让键过期...');
    await sleep(2000);

    result = service.getKeyStatus(key);
    printResult(result, '查询过期后的状态');

    result = service.startProcessing(key);
    printResult(result, '尝试开始处理过期键');
  }

  printSection('测试8: 作用域规则');
  {
    const scope = 'payment-service';
    
    let result = service.setScopeRule(scope, { maxKeys: 2 });
    printResult(result, '设置作用域规则（最大2个键）');

    result = service.registerKey({
      key: 'pay-001',
      scope,
      requestBody: { paymentId: '001' }
    });
    printResult(result, '登记第1个键');

    result = service.registerKey({
      key: 'pay-002',
      scope,
      requestBody: { paymentId: '002' }
    });
    printResult(result, '登记第2个键');

    result = service.registerKey({
      key: 'pay-003',
      scope,
      requestBody: { paymentId: '003' }
    });
    printResult(result, '登记第3个键（超出限制）');
  }

  printSection('测试9: 追踪查询');
  {
    console.log('=== 批量查询幂等键 ===');
    let result = service.queryKeys({ scope: 'order-service' });
    printResult(result, '查询order-service作用域的所有键');

    console.log('=== 查询冲突历史 ===');
    result = service.getConflictHistory();
    printResult(result, '查询所有冲突记录');

    console.log('=== 查询事件流 ===');
    result = service.getEvents();
    console.log(`  事件总数: ${result.data.length}`);
    console.log(`  最近10个事件:`);
    result.data.slice(-10).forEach((event, index) => {
      console.log(`    ${index + 1}. ${new Date(event.timestamp).toISOString()} - ${event.type}`);
    });
  }

  printSection('测试10: 统计信息');
  {
    const result = service.getStats();
    printResult(result, '获取服务统计');
  }

  printSection('测试11: 后台任务');
  {
    let result = service.queueBackgroundTask({
      type: 'report',
      params: { reportType: 'daily' },
      maxRetries: 2
    });
    printResult(result, '提交报告生成任务');

    const taskId = result.data.taskId;

    console.log('等待任务执行...');
    await sleep(2000);

    result = service.getTaskStatus(taskId);
    printResult(result, '查询任务状态');
  }

  printSection('测试12: 失败后重跑指南');
  {
    const key = 'order-008';
    
    console.log('场景：业务方提交请求后超时，不确定结果\n');

    let result = service.registerKey({
      key,
      scope: 'order-service',
      requestBody: { orderId: '008', amount: 800 }
    });
    printResult(result, '1. 首先登记幂等键');

    result = service.startProcessing(key);
    printResult(result, '2. 开始处理');

    console.log('--- 业务方超时，不确定是否成功 ---\n');

    console.log('正确操作步骤：');
    console.log('  步骤1: 查询幂等键状态');
    result = service.getKeyStatus(key);
    printResult(result, '查询状态');

    console.log('  步骤2: 如果状态是 PROCESSING，等待或撤销');
    console.log('  步骤3: 如果状态是 SUCCESS，直接复用结果');
    console.log('  步骤4: 如果状态是 FAILED，调用重试接口');
    console.log('  步骤5: 如果超过最大重试次数，需要：');
    console.log('     a) 撤销原幂等键');
    console.log('     b) 生成新的幂等键重新登记');
    console.log('     c) 确保业务逻辑不会重复执行');

    console.log('\n错误操作示例：');
    console.log('  ✗ 直接使用相同幂等键重新登记 → 会被拦截');
    console.log('  ✗ 不查询状态直接重试 → 可能导致重复执行');
    console.log('  ✗ 每次失败都重新生成新键 → 无法追踪完整历史');
  }

  printSection('所有测试完成！');
  
  console.log(`
===========================================================
  总结：幂等键状态流转图
===========================================================
  
  登记(REGISTERED)
        │
        ▼
  开始处理(PROCESSING)
        │
   ┌────┴────┐
   ▼         ▼
  成功(SUCCESS)  失败(FAILED)
                    │
                    ▼
              重试(REGISTERED) ← 未超过最大次数
                    │
                    ▼
              超过最大次数 → 撤销(REVOKED) → 使用新键重新登记
  
===========================================================
  关键操作说明：
===========================================================
  
  1. 冲突时怎么办？
     - 先查询 /api/conflicts 获取详细解释
     - 检查 /api/keys/:key 确认当前状态
     - 查看 /api/events 了解完整历史
     - 如需强制重跑：撤销 → 使用新键重新登记
  
  2. 失败后如何继续？
     - 检查 retryCount < maxRetryCount
     - 是：调用 POST /api/keys/:key/retry
     - 否：调用 POST /api/keys/:key/revoke，然后使用新键
  
  3. 超时后如何判断？
     - 先查询幂等键状态
     - PROCESSING：等待或检查实际业务结果
     - SUCCESS：直接复用结果，无需重跑
     - FAILED：按失败流程处理
     - 注意：API超时 ≠ 业务处理失败
  
  4. 后台任务失败表现：
     - 任务进入 'retrying' 状态
     - 自动重新入队
     - 超过 maxRetries 后标记 'failed'
     - 可通过 /api/tasks/:taskId 查询状态
     - 失败任务不会自动重试，需要手动提交新任务
  
===========================================================
  `);

  service.stop();
}

runTests().catch(console.error);
