const fs = require('fs');
const path = require('path');
const { getDatabase, initDatabase } = require('../config/database');
const dlxService = require('../src/services/dlx.service');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let passed = 0;
let failed = 0;
let skipped = 0;

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

async function testSkip(name) {
  console.log(`${colors.cyan}○ SKIP${colors.reset}: ${name}`);
  skipped++;
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

async function cleanDatabase(db) {
  const tables = ['retry_reports', 'dlx_messages', 'dlx_batches', 'callback_events'];
  for (const table of tables) {
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM ${table}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

async function runTests() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Webhook DLX API - 完整功能测试${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  const db = getDatabase();
  await cleanDatabase(db);
  dlxService.clearMockResponses();

  console.log(`${colors.blue}=== 基础数据测试 ===${colors.reset}\n`);

  await test('错误类型列表 - 返回6种标准错误类型', async () => {
    const types = await dlxService.listErrorTypes();
    assertEqual(types.length, 6, '错误类型数量');
    const codes = types.map(t => t.error_code);
    assertTrue(codes.includes('NETWORK_ERROR'), '包含NETWORK_ERROR');
    assertTrue(codes.includes('HTTP_500_ERROR'), '包含HTTP_500_ERROR');
    assertTrue(codes.includes('HTTP_400_ERROR'), '包含HTTP_400_ERROR');
    assertTrue(codes.includes('TIMEOUT_ERROR'), '包含TIMEOUT_ERROR');
    assertTrue(codes.includes('SIGNATURE_ERROR'), '包含SIGNATURE_ERROR');
    assertTrue(codes.includes('UNKNOWN_ERROR'), '包含UNKNOWN_ERROR');
  });

  await test('重试策略列表 - 返回3种标准策略', async () => {
    const strategies = await dlxService.listStrategies();
    assertEqual(strategies.length, 3, '策略数量');
    const codes = strategies.map(s => s.strategy_code);
    assertTrue(codes.includes('STANDARD'), '包含STANDARD');
    assertTrue(codes.includes('AGGRESSIVE'), '包含AGGRESSIVE');
    assertTrue(codes.includes('CONSERVATIVE'), '包含CONSERVATIVE');
  });

  console.log(`\n${colors.blue}=== 核心流程测试 ===${colors.reset}\n`);

  let event1, event2, errorTypes, strategies;

  await test('创建回调事件成功', async () => {
    event1 = await dlxService.createEvent({
      eventType: 'order.paid',
      payload: { orderId: '123', amount: 99.99 },
      callbackUrl: 'https://example.com/webhook/orders'
    });
    assertNotNull(event1.id);
    assertEqual(event1.event_type, 'order.paid');
  });

  await test('创建第二个回调事件成功', async () => {
    event2 = await dlxService.createEvent({
      eventType: 'user.created',
      payload: { userId: '456', name: 'test' },
      callbackUrl: 'https://example.com/webhook/users'
    });
    assertNotNull(event2.id);
  });

  errorTypes = await dlxService.listErrorTypes();
  strategies = await dlxService.listStrategies();

  let message1, message2, message3;

  await test('创建死信消息成功', async () => {
    message1 = await dlxService.createDlxMessage(
      event1.id, errorTypes[0].id,
      { url: 'https://example.com/webhook/orders', payload: { orderId: '123' } },
      { originalError: 'ECONNREFUSED', capturedAt: Date.now() }
    );
    assertNotNull(message1.id);
    assertEqual(message1.status, 'pending');
    assertEqual(message1.retryCount, 0);
  });

  await test('创建第二个死信消息（同一错误类型）', async () => {
    message2 = await dlxService.createDlxMessage(
      event2.id, errorTypes[0].id,
      { url: 'https://example.com/webhook/users', payload: { userId: '456' } },
      { originalError: 'ECONNREFUSED', capturedAt: Date.now() }
    );
    assertNotNull(message2.id);
  });

  await test('创建第三个死信消息（不同错误类型）', async () => {
    message3 = await dlxService.createDlxMessage(
      event1.id, errorTypes[1].id,
      { url: 'https://example.com/webhook/orders', payload: { orderId: '789' } },
      { originalError: '500 Internal Server Error', capturedAt: Date.now() }
    );
    assertNotNull(message3.id);
  });

  await test('按错误类型分组统计正确', async () => {
    const groups = await dlxService.groupByErrorType();
    const networkGroup = groups.find(g => g.error_code === 'NETWORK_ERROR');
    assertNotNull(networkGroup, '找到NETWORK_ERROR分组');
    assertTrue(networkGroup.message_count >= 2, `网络错误应该有2条，实际${networkGroup.message_count}`);
    assertTrue(networkGroup.pending_count >= 2, 'pending数量正确');
  });

  let batch1;

  await test('创建重试批次成功', async () => {
    batch1 = await dlxService.createBatch(
      '网络错误重试批次-001', errorTypes[0].id, strategies[0].id, 'admin'
    );
    assertNotNull(batch1.id);
    assertEqual(batch1.status, 'pending');
    assertTrue(batch1.total_count >= 2, '批次消息数量正确');
  });

  await test('启动重试批次成功', async () => {
    const startedBatch = await dlxService.startBatch(batch1.id);
    assertEqual(startedBatch.status, 'processing');
    assertNotNull(startedBatch.started_at);
  });

  console.log(`\n${colors.blue}=== 幂等保护测试 ===${colors.reset}\n`);

  let batch1Before;

  await test('首次处理消息成功 - retryCount从0变1', async () => {
    batch1Before = await dlxService.getBatch(batch1.id);
    const messageBefore = await dlxService.getDlxMessage(message1.id);
    assertEqual(messageBefore.retryCount, 0, '处理前retryCount应为0');
    
    const processed = await dlxService.processMessage(message1.id);
    assertEqual(processed.status, 'success');
    assertEqual(processed.retryCount, 1, '处理后retryCount应为1');
    assertNotNull(processed.finalConclusion, '应该有最终结论');
    assertTrue(processed.finalConclusion.includes('重试成功'), '结论应包含重试成功');
  });

  await test('幂等保护 - 重复处理已成功的消息不产生副作用', async () => {
    const messageBeforeRetry = await dlxService.getDlxMessage(message1.id);
    const batchBefore = await dlxService.getBatch(batch1.id);
    
    const processedAgain = await dlxService.processMessage(message1.id);
    
    const messageAfterRetry = await dlxService.getDlxMessage(message1.id);
    const batchAfter = await dlxService.getBatch(batch1.id);
    
    assertEqual(messageAfterRetry.retryCount, messageBeforeRetry.retryCount, 
      '重复处理不应该增加retryCount');
    assertEqual(batchAfter.success_count, batchBefore.success_count,
      '重复处理不应该增加批次success_count');
    assertEqual(processedAgain.status, 'success', '状态保持success');
  });

  await test('幂等保护 - 验证批次计数只增加一次', async () => {
    const batch = await dlxService.getBatch(batch1.id);
    assertEqual(batch.success_count, 1, '批次成功数应为1，不是2');
  });

  console.log(`\n${colors.blue}=== 失败路径与错误归因测试 ===${colors.reset}\n`);

  await test('设置Mock失败响应 - 500错误', async () => {
    dlxService.setMockResponse('https://example.com/webhook/users', {
      success: false,
      statusCode: 500,
      message: 'Internal Server Error'
    });
  });

  let failedMessage;

  await test('回调失败 - 消息状态变为failed', async () => {
    failedMessage = await dlxService.processMessage(message2.id);
    assertEqual(failedMessage.status, 'failed', '失败回调后状态应该是failed');
    assertEqual(failedMessage.retryCount, 1, '应该增加重试次数');
    assertNotNull(failedMessage.lastError, '应该记录错误信息');
    assertNotNull(failedMessage.processingEvidence, '应该有处理证据');
    assertEqual(failedMessage.processingEvidence.errorType, 'server_error', '错误类型应该是server_error');
  });

  await test('失败归因 - processingEvidence包含完整错误信息', async () => {
    const msg = await dlxService.getDlxMessage(message2.id);
    const evidence = msg.processingEvidence;
    
    assertNotNull(evidence.attempt, '应该有尝试次数');
    assertEqual(evidence.success, false, 'success标记为false');
    assertNotNull(evidence.errorType, '应该有错误分类');
    assertNotNull(evidence.errorMessage, '应该有错误消息');
    assertNotNull(evidence.statusCode, '应该有HTTP状态码');
    assertNotNull(evidence.timestamp, '应该有时间戳');
  });

  await test('失败后批次失败计数正确', async () => {
    const batch = await dlxService.getBatch(batch1.id);
    assertEqual(batch.fail_count, 1, '批次失败数应为1');
  });

  console.log(`\n${colors.blue}=== 人工修正流程测试 ===${colors.reset}\n`);

  let manualMessage, manualBatch;

  await test('创建需要人工处理的消息', async () => {
    const event = await dlxService.createEvent({
      eventType: 'payment.failed',
      payload: { paymentId: 'PAY001', error: 'invalid_signature' },
      callbackUrl: 'https://example.com/failed'
    });
    
    manualMessage = await dlxService.createDlxMessage(
      event.id, errorTypes[4].id,
      { 
        url: 'https://example.com/failed', 
        payload: { badData: 'xxx', wrongSignature: 'invalid' } 
      },
      { originalError: 'Signature verification failed' }
    );
    assertNotNull(manualMessage.id);
  });

  await test('人工修正消息 - 重置状态和重试次数', async () => {
    const corrected = await dlxService.manualCorrect(
      manualMessage.id, 
      { 
        url: 'https://example.com/correct', 
        payload: { goodData: 'yyy', correctSignature: 'valid' } 
      },
      'operator_001'
    );
    
    assertEqual(corrected.status, 'pending', '修正后状态应为pending');
    assertEqual(corrected.retryCount, 0, '重试次数应重置为0');
    assertNotNull(corrected.manuallyCorrectedInput, '应该记录修正后的输入');
    assertNotNull(corrected.processingEvidence.correctedBy, '应该记录操作员');
    assertEqual(corrected.processingEvidence.correctedBy, 'operator_001', '操作员正确');
  });

  await test('创建人工修正批次', async () => {
    manualBatch = await dlxService.createBatch(
      '签名错误人工修正批次', errorTypes[4].id, strategies[0].id, 'system'
    );
    await dlxService.startBatch(manualBatch.id);
  });

  await test('人工修正后重新处理成功', async () => {
    const beforeMessage = await dlxService.getDlxMessage(manualMessage.id);
    assertEqual(beforeMessage.retryCount, 0, '修正后重试次数应为0');
    
    const reprocessed = await dlxService.processMessage(manualMessage.id);
    assertEqual(reprocessed.status, 'success', '修正后重试应成功');
    assertTrue(reprocessed.retryCount > 0, '重试次数应该增加');
  });

  console.log(`\n${colors.blue}=== 达到最大重试次数转人工处理 ===${colors.reset}\n`);

  await test('设置Mock持续失败', async () => {
    dlxService.setMockResponse('https://example.com/always-fail', {
      success: false,
      statusCode: 503,
      message: 'Service Unavailable'
    });
  });

  let maxRetryEvent, maxRetryMessage, maxRetryBatch;

  await test('创建测试消息 - 最大重试次数边界', async () => {
    maxRetryEvent = await dlxService.createEvent({
      eventType: 'test.retry',
      payload: { test: 'max' },
      callbackUrl: 'https://example.com/always-fail'
    });
    
    maxRetryMessage = await dlxService.createDlxMessage(
      maxRetryEvent.id, errorTypes[1].id,
      { url: 'https://example.com/always-fail', payload: { test: '1' } }
    );
  });

  await test('达到最大重试次数后转人工处理', async () => {
    maxRetryBatch = await dlxService.createBatch(
      '最大重试测试批次', errorTypes[1].id, strategies[0].id, 'system'
    );
    await dlxService.startBatch(maxRetryBatch.id);
    
    const strategy = strategies[0];
    let msg = await dlxService.getDlxMessage(maxRetryMessage.id);
    
    for (let i = 0; i < strategy.max_retries; i++) {
      msg = await dlxService.processMessage(msg.id);
    }
    
    assertEqual(msg.status, 'manual_required', '达到最大次数后状态应为manual_required');
    assertNotNull(msg.finalConclusion, '应该有最终结论');
    assertTrue(msg.finalConclusion.includes('需要人工介入'), '结论应提及人工介入');
  });

  console.log(`\n${colors.blue}=== 报告导出与统计测试 ===${colors.reset}\n`);

  let report;

  await test('生成批次报告成功', async () => {
    report = await dlxService.generateReport(batch1.id);
    assertNotNull(report.batch);
    assertNotNull(report.summary);
    assertNotNull(report.messages);
  });

  await test('报告统计数据正确', async () => {
    assertEqual(report.summary.total, batch1.total_count, '总数正确');
    assertEqual(report.summary.success, 1, '成功数正确');
    assertEqual(report.summary.failed, 1, '失败数正确');
    assertNotNull(report.summary.successRate, '应该有成功率');
    assertNotNull(report.errorBreakdown, '应该有错误分类统计');
  });

  await test('报告包含错误分类统计', async () => {
    assertTrue(Object.keys(report.errorBreakdown).length > 0, '错误分类不为空');
  });

  await test('导出消息数据成功', async () => {
    const exported = await dlxService.exportMessages(batch1.id);
    assertTrue(Array.isArray(exported), '导出是数组');
    assertTrue(exported.length > 0, '导出有数据');
    assertNotNull(exported[0].id, '每条数据有ID');
    assertNotNull(exported[0].final_conclusion, '每条数据有最终结论');
  });

  console.log(`\n${colors.blue}=== 查询与分页测试 ===${colors.reset}\n`);

  await test('查询死信消息列表 - 分页工作', async () => {
    const result = await dlxService.listDlxMessages({}, { page: 1, limit: 10 });
    assertTrue(result.pagination.total >= 4, '消息总数正确');
    assertEqual(result.pagination.page, 1, '页码正确');
    assertEqual(result.pagination.limit, 10, '每页数量正确');
  });

  await test('按状态筛选消息', async () => {
    const result = await dlxService.listDlxMessages({ status: 'success' }, { page: 1, limit: 10 });
    assertTrue(result.data.every(m => m.status === 'success'), '所有消息都是success状态');
  });

  await test('按错误类型筛选消息', async () => {
    const result = await dlxService.listDlxMessages({ errorTypeId: errorTypes[0].id }, { page: 1, limit: 10 });
    assertTrue(result.data.every(m => m.errorTypeId === errorTypes[0].id), '所有消息都是指定错误类型');
  });

  await test('查询批次列表', async () => {
    const result = await dlxService.listBatches({}, { page: 1, limit: 10 });
    assertTrue(result.pagination.total >= 3, '批次总数正确');
  });

  console.log(`\n${colors.blue}=== 脏数据与错误边界测试 ===${colors.reset}\n`);

  await test('查询不存在的消息返回null', async () => {
    const result = await dlxService.getDlxMessage('non-existent-id-12345');
    assertEqual(result, null);
  });

  await test('启动不存在的批次抛出错误', async () => {
    try {
      await dlxService.startBatch('non-existent-batch-id');
      throw new Error('应该抛出错误');
    } catch (err) {
      assertEqual(err.message, '批次不存在', '错误消息正确');
    }
  });

  await test('获取不存在的批次返回null', async () => {
    const result = await dlxService.getBatch('non-existent-batch-id');
    assertEqual(result, null);
  });

  await test('生成不存在批次的报告抛出错误', async () => {
    try {
      await dlxService.generateReport('non-existent-batch-id');
      throw new Error('应该抛出错误');
    } catch (err) {
      assertEqual(err.message, '批次不存在', '错误消息正确');
    }
  });

  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.green}测试完成!${colors.reset}`);
  console.log(`${colors.green}通过: ${passed}${colors.reset}`);
  console.log(`${colors.red}失败: ${failed}${colors.reset}`);
  console.log(`${colors.cyan}跳过: ${skipped}${colors.reset}`);
  console.log(`${colors.blue}成功率: ${passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : 0}%${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('测试运行出错:', err);
  console.error(err.stack);
  process.exit(1);
});
