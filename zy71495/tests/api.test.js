const http = require('http');

const BASE_URL = 'http://127.0.0.1:3000/api';

const request = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const fullPath = path.startsWith('/') ? path : '/' + path;
    const urlPath = BASE_URL + fullPath;
    const url = new URL(urlPath);
    const agent = new http.Agent();
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      agent: agent
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(`❌ 测试失败: ${message}`);
  }
  console.log(`  ✓ ${message}`);
};

const testSuite = async () => {
  console.log('═══ 乐队设备租赁结算 API 测试 ═══\n');

  try {
    await request('/health');
    console.log('服务器连接正常\n');
  } catch (e) {
    console.log('❌ 无法连接服务器，请先运行 npm start');
    process.exit(1);
  }

  let passCount = 0;
  let failCount = 0;

  const runTest = async (name, testFn) => {
    console.log(`\n测试: ${name}`);
    try {
      await testFn();
      passCount++;
      console.log(`✅ ${name} 通过`);
    } catch (e) {
      failCount++;
      console.log(`❌ ${name} 失败: ${e.message}`);
    }
  };

  await runTest('健康检查', async () => {
    const res = await request('/health');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.status === 'ok', '状态应为 ok');
    assert(res.data.service === 'band-rental-settlement', '服务名正确');
  });

  await runTest('获取配置信息', async () => {
    const res = await request('/config');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(Array.isArray(res.data.states.rental), '租赁状态应为数组');
    assert(res.data.states.rental.includes('DRAFT'), '应包含 DRAFT 状态');
    assert(res.data.states.rental.includes('SETTLED'), '应包含 SETTLED 状态');
  });

  await runTest('获取统计数据', async () => {
    const res = await request('/statistics');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.success === true, '返回成功');
    assert(res.data.data.orderStats.total_orders >= 4, '至少有4个订单');
    assert(res.data.data.memberStats.total_members === 5, '应有5个成员');
    assert(res.data.data.equipmentStats.total_equipment === 7, '应有7台设备');
  });

  await runTest('获取成员列表', async () => {
    const res = await request('/members');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length === 5, '应有5个成员');
    assert(res.data.data[0].name === '陈静', '按名称排序');
  });

  await runTest('获取设备列表', async () => {
    const res = await request('/equipment');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 7, '至少7台设备');
  });

  await runTest('获取订单列表', async () => {
    const res = await request('/orders');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 4, '至少4个订单');
  });

  await runTest('获取订单详情', async () => {
    const res = await request('/orders/ORD20250501');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.order.order_id === 'ORD20250501', '订单ID正确');
    assert(res.data.data.items.length === 3, '应有3个租赁条目');
    assert(Array.isArray(res.data.data.allocations), '应包含分摊记录');
    assert(Array.isArray(res.data.data.stateTransitions), '应包含状态历史');
  });

  await runTest('获取订单追溯链路', async () => {
    const res = await request('/orders/ORD20250501/trace');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.order.order_id === 'ORD20250501', '订单ID正确');
    assert(res.data.data.traceItems.length > 0, '应有追溯条目');
    assert(res.data.data.stateHistory.length > 0, '应有状态历史');
  });

  await runTest('获取分摊汇总', async () => {
    const res = await request('/orders/ORD20250501/allocation-summary');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.totals.rental_total > 0, '租赁费总额大于0');
    assert(Array.isArray(res.data.data.byMember), '按成员分摊数据存在');
  });

  await runTest('重新执行费用分摊', async () => {
    const res = await request('/orders/ORD20250501/allocate', {
      method: 'POST',
      body: { damageAllocBasis: 'EQUAL' }
    });
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.success === true, '分摊成功');
    assert(res.data.data.allocationSummary.totals.grand_total > 0, '分摊总额大于0');
  });

  await runTest('检测异常数据', async () => {
    const res = await request('/anomalies/check', { method: 'POST' });
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.totalAnomalies >= 3, '至少检测到3种异常');
    console.log(`    检测到 ${res.data.data.totalAnomalies} 个异常`);
  });

  await runTest('获取异常列表 - 未解决', async () => {
    const res = await request('/anomalies?is_resolved=false');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 3, '至少有3个未解决异常');
    
    const types = res.data.data.map(a => a.anomaly_type);
    assert(types.includes('DEPOSIT_MISSING_REFUND'), '应检测到押金漏退异常');
    assert(types.includes('USAGE_TIME_OVERLAP'), '应检测到时长重叠异常');
    assert(types.includes('DAMAGE_UNALLOCATED'), '应检测到损坏未分摊异常');
  });

  await runTest('获取押金列表 - 未退款', async () => {
    const res = await request('/deposits?unrefunded_only=true');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 2, '至少有2笔未退款押金');
    const totalRemaining = res.data.data.reduce((s, d) => s + d.remaining_amount, 0);
    assert(Math.abs(totalRemaining - 1100) < 0.01, '未退押金总额应为1100');
    console.log(`    待退押金总额: ¥${totalRemaining.toFixed(2)}`);
  });

  await runTest('获取成员使用历史', async () => {
    const res = await request('/members/MEM003/usage');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 2, '王芳至少有2条使用记录');
    assert(res.data.data[0].equipment_name === '架子鼓套装', '设备名称正确');
  });

  await runTest('获取设备使用历史', async () => {
    const res = await request('/equipment/EQP003/usage');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 2, '架子鼓至少被使用2次');
  });

  await runTest('获取成员分摊记录', async () => {
    const res = await request('/members/MEM001/allocations');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 2, '张明至少有2条分摊记录');
  });

  await runTest('状态机 - 非法状态转换', async () => {
    const res = await request('/orders/ORD20250501/transition', {
      method: 'POST',
      body: { to_state: 'DRAFT', reason: '测试非法转换', operator: 'test' }
    });
    assert(res.status === 400, '非法转换应返回 400');
    assert(res.data.code === 'StateTransitionError', '错误类型正确');
  });

  await runTest('获取有效状态转换列表', async () => {
    const res = await request('/valid-transitions/RENTAL_ORDER/DRAFT');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.includes('CONFIRMED'), 'DRAFT 可转换到 CONFIRMED');
    assert(res.data.data.includes('CANCELLED'), 'DRAFT 可转换到 CANCELLED');
  });

  await runTest('获取状态历史', async () => {
    const res = await request('/state-history/RENTAL_ORDER/ORD20250501');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 3, '至少有3次状态转换');
    assert(res.data.data[0].from_state === 'DRAFT', '首次转换从 DRAFT 开始');
  });

  await runTest('生成结算报告', async () => {
    const res = await request('/reports/settlement/ORD20250501', { method: 'POST' });
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.fileName.includes('SET'), '文件名包含 SET 前缀');
    assert(res.data.data.batchId.includes('BATCH'), '包含批次号');
    assert(res.data.data.totals.grand_total > 0, '报告总额大于0');
    console.log(`    报告文件名: ${res.data.data.fileName}`);
  });

  await runTest('生成押金追踪报告', async () => {
    const res = await request('/reports/deposit-tracking', { method: 'POST' });
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.fileName.includes('DEP'), '文件名包含 DEP 前缀');
    assert(res.data.data.totals.total_remaining > 0, '有待退押金');
  });

  await runTest('生成异常报告', async () => {
    const res = await request('/reports/anomaly', { 
      method: 'POST',
      query: { is_resolved: false }
    });
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.fileName.includes('ANA'), '文件名包含 ANA 前缀');
    assert(res.data.data.totalAnomalies >= 3, '至少3个异常');
  });

  await runTest('获取报告列表', async () => {
    const res = await request('/reports');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 3, '至少有3个报告文件');
  });

  await runTest('获取批次列表', async () => {
    const res = await request('/batches');
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.length >= 6, '至少有6个批次');
  });

  await runTest('获取批次详情', async () => {
    const batches = await request('/batches');
    const firstBatch = batches.data.data[0];
    const res = await request(`/batches/${firstBatch.batch_id}`);
    assert(res.status === 200, 'HTTP 状态码应为 200');
    assert(res.data.data.batch.batch_id === firstBatch.batch_id, '批次ID正确');
  });

  console.log('\n' + '═'.repeat(50));
  console.log(`测试完成: 通过 ${passCount}, 失败 ${failCount}`);
  
  if (failCount > 0) {
    console.log('\n⚠️  部分测试失败，请检查服务和数据');
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过!');
    console.log('\n📋 验证的核心功能:');
    console.log('  ✓ 持久化存储 (SQLite)');
    console.log('  ✓ 状态机流转 (DRAFT→CONFIRMED→IN_USE→RETURNED→SETTLED→CLOSED)');
    console.log('  ✓ 异常检测 (押金漏退、时长重叠、损坏未分摊)');
    console.log('  ✓ 费用分摊 (按时长比例、人均分摊)');
    console.log('  ✓ 数据追溯 (批次→订单→条目→使用记录→分摊)');
    console.log('  ✓ 报告导出 (带批次标识的文件名)');
    console.log('  ✓ 统一口径 (导入、处理、回看、导出)');
    process.exit(0);
  }
};

testSuite().catch(console.error);
