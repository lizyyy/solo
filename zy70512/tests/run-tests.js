const { getDatabase } = require('../config/database');
const dlxService = require('../src/services/dlx.service');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`${colors.green}✓ PASS${colors.reset}: ${name}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}✗ FAIL${colors.reset}: ${name}`);
    console.log(`  ${colors.yellow}Error:${colors.reset} ${error.message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(message || 'Expected true, got false');
  }
}

function assertNotNull(value, message = '') {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected not null, got null');
  }
}

async function runTests() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}开始运行 Webhook DLX API 测试${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  const db = getDatabase();

  console.log(`${colors.blue}--- 测试 1: 基础数据 - 错误类型列表${colors.reset}`);
  await test('应该返回至少6种错误类型', async () => {
    const types = await dlxService.listErrorTypes();
    assertTrue(types.length >= 6, `Expected at least 6 error types, got ${types.length}`);
  });

  console.log(`\n${colors.blue}--- 测试 2: 基础数据 - 重试策略列表${colors.reset}`);
  await test('应该返回至少3种重试策略', async () => {
    const strategies = await dlxService.listStrategies();
    assertTrue(strategies.length >= 3, `Expected at least 3 strategies, got ${strategies.length}`);
  });

  console.log(`\n${colors.blue}--- 测试 3: 正常流程 - 创建回调事件和死信消息${colors.reset}`);
  
  let event1, event2, message1, message2, message3;
  const errorTypes = await dlxService.listErrorTypes();
  const strategies = await dlxService.listStrategies();

  await test('创建回调事件成功', async () => {
    event1 = await dlxService.createEvent({
      eventType: 'order.paid',
      payload: { orderId: '123', amount: 99.99 },
      callbackUrl: 'https://example.com/webhook'
    });
    assertNotNull(event1);
    assertNotNull(event1.id);
  });

  await test('创建第二个回调事件成功', async () => {
    event2 = await dlxService.createEvent({
      eventType: 'user.created',
      payload: { userId: '456', name: 'test' },
      callbackUrl: 'https://example.com/webhook/user'
    });
    assertNotNull(event2);
  });

  await test('创建第一个死信消息成功', async () => {
    message1 = await dlxService.createDlxMessage(
      event1.id, errorTypes[0].id,
      { url: 'https://example.com/webhook', payload: { test: 1 }, headers: {} },
      { error: 'Connection refused', timestamp: Date.now() }
    );
    assertNotNull(message1);
    assertEqual(message1.status, 'pending');
  });

  await test('创建第二个死信消息（同一错误类型）成功', async () => {
    message2 = await dlxService.createDlxMessage(
      event2.id, errorTypes[0].id,
      { url: 'https://example.com/webhook/user', payload: { user: 1 } },
      { error: 'Connection refused', timestamp: Date.now() }
    );
    assertNotNull(message2);
    assertEqual(message2.status, 'pending');
  });

  await test('创建第三个死信消息（不同错误类型）成功', async () => {
    message3 = await dlxService.createDlxMessage(
      event1.id, errorTypes[1].id,
      { url: 'https://example.com/webhook', payload: { test: 2 } },
      { error: '500 Internal Server Error', timestamp: Date.now() }
    );
    assertNotNull(message3);
  });

  console.log(`\n${colors.blue}--- 测试 4: 正常流程 - 按错误类型分组${colors.reset}`);
  
  await test('按错误类型分组统计正确', async () => {
    const groups = await dlxService.groupByErrorType();
    assertTrue(groups.length > 0);
    const networkGroup = groups.find(g => g.error_code === 'NETWORK_ERROR');
    assertNotNull(networkGroup);
    assertTrue(networkGroup.message_count >= 2);
  });

  console.log(`\n${colors.blue}--- 测试 5: 正常流程 - 创建和启动重试批次${colors.reset}`);
  
  let batch1;
  await test('创建重试批次成功', async () => {
    batch1 = await dlxService.createBatch(
      '网络错误重试批次-001', errorTypes[0].id, strategies[0].id, 'admin'
    );
    assertNotNull(batch1);
    assertEqual(batch1.status, 'pending');
    assertTrue(batch1.total_count >= 2);
  });

  await test('启动重试批次成功', async () => {
    const startedBatch = await dlxService.startBatch(batch1.id);
    assertEqual(startedBatch.status, 'processing');
  });

  console.log(`\n${colors.blue}--- 测试 6: 正常流程 - 处理死信消息${colors.reset}`);
  
  await test('处理消息成功', async () => {
    const processed = await dlxService.processMessage(message1.id);
    assertEqual(processed.status, 'success');
    assertEqual(processed.retryCount, 1);
  });

  console.log(`\n${colors.blue}--- 测试 7: 脏数据测试 - 参数验证${colors.reset}`);
  
  await test('创建消息时缺少必填参数应该失败', async () => {
    try {
      await dlxService.createDlxMessage(null, errorTypes[0].id, {});
      throw new Error('应该抛出错误');
    } catch (err) {
      assertTrue(err.message.includes('NULL') || err.message.includes('SQLITE') || err.message.includes('violates'), 
                 `预期数据库约束错误，实际错误: ${err.message}`);
    }
  });

  await test('查询不存在的消息应该返回null', async () => {
    const result = await dlxService.getDlxMessage('non-existent-id');
    assertEqual(result, null);
  });

  await test('启动不存在的批次应该失败', async () => {
    try {
      await dlxService.startBatch('non-existent-id');
      throw new Error('应该抛出错误');
    } catch (err) {
      assertEqual(err.message, '批次不存在');
    }
  });

  console.log(`\n${colors.blue}--- 测试 8: 幂等保护测试 - 重复请求${colors.reset}`);
  
  await test('重复创建批次应该正常（每个批次有独立ID）', async () => {
    const batchA = await dlxService.createBatch('测试批次A', errorTypes[1].id, strategies[1].id);
    const batchB = await dlxService.createBatch('测试批次B', errorTypes[1].id, strategies[1].id);
    assertTrue(batchA.id !== batchB.id);
  });

  await test('重复处理已成功的消息应该是安全的', async () => {
    const processed = await dlxService.processMessage(message1.id);
    assertEqual(processed.status, 'success');
  });

  console.log(`\n${colors.blue}--- 测试 9: 人工修正流程${colors.reset}`);
  
  let manualMessage;
  await test('创建需要人工处理的消息', async () => {
    const event = await dlxService.createEvent({
      eventType: 'test.manual',
      payload: { data: 'wrong' },
      callbackUrl: 'https://example.com/failed'
    });
    
    manualMessage = await dlxService.createDlxMessage(
      event.id, errorTypes[2].id,
      { url: 'https://example.com/failed', payload: { data: 'wrong' } }
    );
    assertNotNull(manualMessage);
  });

  await test('人工修正消息成功', async () => {
    const corrected = await dlxService.manualCorrect(
      manualMessage.id, 
      { url: 'https://example.com/correct', payload: { data: 'correct' } },
      'operator_001'
    );
    assertEqual(corrected.status, 'pending');
    assertNotNull(corrected.manuallyCorrectedInput);
    assertEqual(corrected.retryCount, 0);
  });

  await test('人工修正后重新处理成功', async () => {
    const correctedMessage = await dlxService.getDlxMessage(manualMessage.id);
    const batch = await dlxService.createBatch(
      '人工修正后重试', errorTypes[2].id, strategies[0].id
    );
    await dlxService.startBatch(batch.id);
    
    const messageWithBatch = await dlxService.getDlxMessage(manualMessage.id);
    const reprocessed = await dlxService.processMessage(messageWithBatch.id);
    assertEqual(reprocessed.status, 'success');
  });

  console.log(`\n${colors.blue}--- 测试 10: 查询和导出功能${colors.reset}`);
  
  await test('查询死信消息列表（分页）', async () => {
    const result = await dlxService.listDlxMessages({}, { page: 1, limit: 10 });
    assertTrue(result.pagination.total > 0);
    assertTrue(result.data.length > 0);
  });

  await test('按状态筛选消息', async () => {
    const result = await dlxService.listDlxMessages({ status: 'success' }, { page: 1, limit: 10 });
    assertTrue(result.data.every(m => m.status === 'success'));
  });

  await test('查询批次列表', async () => {
    const result = await dlxService.listBatches({}, { page: 1, limit: 10 });
    assertTrue(result.pagination.total > 0);
  });

  await test('生成批次报告', async () => {
    const report = await dlxService.generateReport(batch1.id);
    assertNotNull(report);
    assertNotNull(report.summary);
    assertNotNull(report.messages);
  });

  await test('导出消息数据', async () => {
    const exported = await dlxService.exportMessages(batch1.id);
    assertTrue(Array.isArray(exported));
  });

  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.green}测试完成!${colors.reset}`);
  console.log(`${colors.green}通过: ${passed}${colors.reset}`);
  console.log(`${colors.red}失败: ${failed}${colors.reset}`);
  console.log(`${colors.blue}成功率: ${passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : 0}%${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行出错:', err);
  process.exit(1);
});
