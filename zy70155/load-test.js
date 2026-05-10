const { IdempotentKeyService, KEY_STATUS } = require('./idempotentKey');
const { v4: uuidv4 } = require('uuid');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoadTest() {
  console.log(`
===========================================================
  幂等键服务压测样例
===========================================================
`);

  const service = new IdempotentKeyService({
    defaultTTL: 60000,
    maxRetryCount: 3,
    cleanupInterval: 30000
  });
  service.start();

  const scenarios = [
    { name: '场景1: 正常并发登记', count: 100, description: '100个不同的幂等键并发登记' },
    { name: '场景2: 冲突压测', count: 100, description: '同一幂等键被100次并发登记' },
    { name: '场景3: 混合场景', count: 50, description: '50个键各被重复登记3次' },
    { name: '场景4: 状态流转压力', count: 50, description: '50个键完整生命周期' }
  ];

  console.log('准备运行以下压测场景：\n');
  scenarios.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name}`);
    console.log(`     ${s.description}\n`);
  });

  for (const scenario of scenarios) {
    await runScenario(service, scenario);
  }

  printFinalReport(service);

  service.stop();
}

async function runScenario(service, scenario) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${scenario.name}`);
  console.log(`  ${scenario.description}`);
  console.log(`${'='.repeat(60)}\n`);

  const startTime = Date.now();
  let successCount = 0;
  let conflictCount = 0;
  let errorCount = 0;
  const results = [];

  if (scenario.name === '场景1: 正常并发登记') {
    const promises = [];
    for (let i = 0; i < scenario.count; i++) {
      const key = `test-key-${uuidv4()}`;
      promises.push(
        Promise.resolve().then(() => {
          const result = service.registerKey({
            key,
            scope: 'load-test',
            requestBody: { index: i }
          });
          return { key, result };
        })
      );
    }

    const outcomes = await Promise.all(promises);
    outcomes.forEach(({ key, result }) => {
      if (result.success) {
        successCount++;
      } else if (result.error.code === 'KEY_CONFLICT') {
        conflictCount++;
      } else {
        errorCount++;
      }
      results.push({ key, success: result.success, code: result.error?.code });
    });

  } else if (scenario.name === '场景2: 冲突压测') {
    const fixedKey = `conflict-test-${uuidv4()}`;
    const promises = [];

    for (let i = 0; i < scenario.count; i++) {
      promises.push(
        Promise.resolve().then(() => {
          const result = service.registerKey({
            key: fixedKey,
            scope: 'load-test',
            requestBody: { attempt: i }
          });
          return { attempt: i, result };
        })
      );
    }

    const outcomes = await Promise.all(promises);
    outcomes.forEach(({ attempt, result }) => {
      if (result.success) {
        successCount++;
      } else if (result.error.code === 'KEY_CONFLICT') {
        conflictCount++;
      } else {
        errorCount++;
      }
      results.push({ attempt, success: result.success, code: result.error?.code });
    });

    const conflictHistory = service.getConflictHistory({ key: fixedKey });
    console.log(`  冲突历史记录数: ${conflictHistory.data.length}`);
    if (conflictHistory.data.length > 0) {
      console.log(`  第一条冲突详情:`);
      console.log(`    幂等键: ${conflictHistory.data[0].key}`);
      console.log(`    原状态: ${conflictHistory.data[0].originalStatus}`);
      console.log(`    时间戳: ${new Date(conflictHistory.data[0].timestamp).toISOString()}`);
      console.log(`\n  冲突解释:`);
      console.log(conflictHistory.data[0].explanation);
    }

  } else if (scenario.name === '场景3: 混合场景') {
    const keys = [];
    for (let i = 0; i < scenario.count; i++) {
      keys.push(`mixed-key-${i}-${uuidv4().slice(0, 8)}`);
    }

    for (const key of keys) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = service.registerKey({
          key,
          scope: 'load-test',
          requestBody: { key, attempt }
        });
        
        if (result.success) {
          successCount++;
        } else if (result.error.code === 'KEY_CONFLICT') {
          conflictCount++;
        } else {
          errorCount++;
        }
        results.push({ key, attempt, success: result.success, code: result.error?.code });
      }
    }

  } else if (scenario.name === '场景4: 状态流转压力') {
    for (let i = 0; i < scenario.count; i++) {
      const key = `lifecycle-key-${i}-${uuidv4().slice(0, 8)}`;

      let result = service.registerKey({
        key,
        scope: 'lifecycle-test',
        requestBody: { index: i }
      });
      if (result.success) successCount++;
      else errorCount++;

      result = service.startProcessing(key);
      if (result.success) successCount++;
      else errorCount++;

      if (i % 3 === 0) {
        result = service.failProcessing(key, '模拟失败');
        if (result.success) successCount++;
        else errorCount++;

        if (result.data.canRetry) {
          result = service.retryProcessing(key);
          if (result.success) successCount++;
          else errorCount++;
        }
      } else {
        result = service.completeProcessing(key, { index: i, status: 'success' });
        if (result.success) successCount++;
        else errorCount++;
      }
    }
  }

  const duration = Date.now() - startTime;
  const throughput = ((successCount + conflictCount + errorCount) / (duration / 1000)).toFixed(2);

  console.log(`\n  压测结果:`);
  console.log(`    总耗时: ${duration}ms`);
  console.log(`    吞吐量: ${throughput} ops/sec`);
  console.log(`    成功数: ${successCount}`);
  console.log(`    冲突数: ${conflictCount}`);
  console.log(`    错误数: ${errorCount}`);
  console.log(`    成功率: ${((successCount / (successCount + conflictCount + errorCount)) * 100).toFixed(2)}%`);

  if (scenario.name === '场景2: 冲突压测') {
    console.log(`\n  冲突分析:`);
    console.log(`    预期成功: 1 (只有第一次登记成功)`);
    console.log(`    实际成功: ${successCount}`);
    console.log(`    预期冲突: ${scenario.count - 1}`);
    console.log(`    实际冲突: ${conflictCount}`);
    console.log(`    结论: ${conflictCount === scenario.count - 1 ? '✓ 幂等性保证正确' : '✗ 需要检查'}`);
  }

  if (scenario.name === '场景3: 混合场景') {
    console.log(`\n  冲突分析:`);
    console.log(`    每个键被登记3次，应产生2次冲突`);
    console.log(`    预期成功: ${scenario.count}`);
    console.log(`    实际成功: ${successCount}`);
    console.log(`    预期冲突: ${scenario.count * 2}`);
    console.log(`    实际冲突: ${conflictCount}`);
  }
}

function printFinalReport(service) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  最终报告`);
  console.log(`${'='.repeat(60)}\n`);

  const stats = service.getStats();
  console.log(`  服务统计:`);
  console.log(`    总键数: ${stats.data.totalKeys}`);
  console.log(`    总事件数: ${stats.data.totalEvents}`);
  console.log(`    总冲突数: ${stats.data.totalConflicts}`);
  console.log(`    状态分布:`);
  Object.entries(stats.data.statusBreakdown).forEach(([status, count]) => {
    console.log(`      ${status}: ${count}`);
  });

  console.log(`\n  查询接口验证:`);
  
  const allKeys = service.queryKeys();
  console.log(`    GET /api/keys 返回: ${allKeys.count} 条记录`);

  const conflicts = service.getConflictHistory();
  console.log(`    GET /api/conflicts 返回: ${conflicts.count} 条记录`);

  const events = service.getEvents();
  console.log(`    GET /api/events 返回: ${events.count} 条记录`);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  压测完成！`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n  可检查的输出：`);
  console.log(`    1. 所有冲突都有详细解释 (查看 /api/conflicts)`);
  console.log(`    2. 所有操作都有事件追踪 (查看 /api/events)`);
  console.log(`    3. 幂等键状态正确流转`);
  console.log(`    4. 冲突不会导致误拦截或重复执行`);
  console.log(`    5. 所有失败场景都有明确的错误码和建议`);

  console.log(`\n  使用HTTP API验证命令：`);
  console.log(`    # 查询所有键`);
  console.log(`    curl http://localhost:3000/api/keys`);
  console.log(`    `);
  console.log(`    # 查询冲突历史`);
  console.log(`    curl http://localhost:3000/api/conflicts`);
  console.log(`    `);
  console.log(`    # 查询事件流`);
  console.log(`    curl http://localhost:3000/api/events`);
  console.log(`    `);
  console.log(`    # 查询特定键的状态`);
  console.log(`    curl http://localhost:3000/api/keys/<key>`);
}

runLoadTest().catch(console.error);
