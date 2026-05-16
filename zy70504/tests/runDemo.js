const http = require('http');
const { sampleSpace, sampleBatch, samplePayloads, sampleException, sampleCorrection, sampleReview } = require('./sampleData');

const BASE_URL = 'localhost';
const PORT = 3000;

const request = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: BASE_URL,
      port: PORT,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runDemo = async () => {
  console.log('='.repeat(60));
  console.log('数据回放隔离API - 演示程序');
  console.log('='.repeat(60));
  console.log();
  
  console.log('检查服务状态...');
  try {
    const health = await request({ method: 'GET', path: '/health' });
    console.log('✓ 服务运行正常:', health.data.status);
  } catch (e) {
    console.log('✗ 服务未启动，请先运行 npm start');
    process.exit(1);
  }
  console.log();
  
  let spaceId, batchId, payloadIds = [];
  
  console.log('1. 创建隔离空间...');
  const spaceRes = await request({ method: 'POST', path: '/api/replay/spaces' }, sampleSpace);
  if (spaceRes.status === 201) {
    spaceId = spaceRes.data.id;
    console.log('✓ 隔离空间创建成功');
    console.log('  Namespace:', spaceRes.data.namespace);
    console.log('  Space ID:', spaceId);
  } else if (spaceRes.status === 500 && spaceRes.data.error.includes('已存在')) {
    console.log('! 隔离空间已存在，查询现有空间...');
    const spacesRes = await request({ method: 'GET', path: '/api/replay/spaces' });
    const existing = spacesRes.data.find(s => s.namespace === sampleSpace.namespace);
    if (existing) {
      spaceId = existing.id;
      console.log('  使用现有空间 ID:', spaceId);
    }
  }
  console.log();
  
  if (!spaceId) {
    console.log('✗ 无法获取隔离空间');
    process.exit(1);
  }
  
  console.log('2. 创建事件批次...');
  const batchRes = await request({ method: 'POST', path: '/api/replay/batches' }, {
    spaceId,
    namespace: sampleSpace.namespace,
    ...sampleBatch
  });
  batchId = batchRes.data.id;
  console.log('✓ 事件批次创建成功');
  console.log('  Batch ID:', batchId);
  console.log();
  
  console.log('3. 添加脱敏载荷...');
  for (let i = 0; i < samplePayloads.length; i++) {
    const payload = samplePayloads[i];
    const payloadRes = await request({ method: 'POST', path: `/api/replay/batches/${batchId}/payloads` }, {
      spaceId,
      namespace: sampleSpace.namespace,
      ...payload
    });
    if (payloadRes.status === 201) {
      payloadIds.push(payloadRes.data.id);
      console.log(`  ✓ 载荷 ${i + 1} 处理完成`);
      console.log(`    事件ID: ${payloadRes.data.id}`);
      console.log(`    校验状态: ${payloadRes.data.validationStatus}`);
    }
  }
  console.log();
  
  console.log('4. 状态机状态推进...');
  const states = ['validating', 'ready', 'running'];
  for (const state of states) {
    const stateRes = await request({ method: 'POST', path: `/api/replay/batches/${batchId}/state` }, {
      namespace: sampleSpace.namespace,
      newState: state,
      operatedBy: 'demo_user'
    });
    console.log(`  ✓ 状态推进至: ${state}`);
    await sleep(500);
  }
  console.log();
  
  console.log('5. 记录写入拦截...');
  for (let i = 0; i < payloadIds.length; i++) {
    await request({ method: 'POST', path: `/api/replay/batches/${batchId}/interceptions` }, {
      spaceId,
      namespace: sampleSpace.namespace,
      payloadId: payloadIds[i],
      originalTarget: 'prod-db-payment',
      interceptedTarget: 'sandbox-db-payment',
      interceptionRules: { type: 'namespace_based_redirect', rule: '^prod-.* -> sandbox-.*' },
      interceptionStatus: 'redirected',
      responseData: { intercepted: true, redirect_to: 'sandbox', timestamp: new Date().toISOString() },
      operatedBy: 'interceptor_service'
    });
    console.log(`  ✓ 拦截 ${i + 1} 记录成功`);
  }
  console.log();
  
  console.log('6. 记录异常...');
  const exRes = await request({ method: 'POST', path: `/api/replay/batches/${batchId}/exceptions` }, {
    spaceId,
    namespace: sampleSpace.namespace,
    payloadId: payloadIds[0],
    ...sampleException
  });
  const exceptionId = exRes.data.id;
  console.log('✓ 异常记录成功');
  console.log('  Exception ID:', exceptionId);
  console.log();
  
  console.log('7. 人工修正...');
  await request({ method: 'POST', path: `/api/replay/batches/${batchId}/corrections` }, {
    spaceId,
    namespace: sampleSpace.namespace,
    payloadId: payloadIds[0],
    exceptionId,
    ...sampleCorrection
  });
  console.log('✓ 人工修正记录成功');
  console.log();
  
  console.log('8. 完成回放状态...');
  await request({ method: 'POST', path: `/api/replay/batches/${batchId}/state` }, {
    namespace: sampleSpace.namespace,
    newState: 'completed',
    operatedBy: 'demo_user'
  });
  console.log('✓ 回放状态推进至: completed');
  console.log();
  
  console.log('9. 创建复盘摘要...');
  await request({ method: 'POST', path: `/api/replay/batches/${batchId}/reviews` }, {
    spaceId,
    namespace: sampleSpace.namespace,
    ...sampleReview
  });
  console.log('✓ 复盘摘要创建成功');
  console.log();
  
  console.log('10. 查询批次详情...');
  const detailRes = await request({ method: 'GET', path: `/api/replay/batches/${batchId}/detail?namespace=${sampleSpace.namespace}` });
  console.log('✓ 批次详情查询成功');
  console.log('  批次名称:', detailRes.data.batch.batch_name);
  console.log('  当前状态:', detailRes.data.replayStatus.current_state);
  console.log('  载荷数量:', detailRes.data.recentPayloads.length);
  console.log('  异常数量:', detailRes.data.recentExceptions.length);
  console.log('  复盘摘要:', detailRes.data.review ? '已创建' : '未创建');
  console.log();
  
  console.log('11. 查询审计日志...');
  const auditRes = await request({ method: 'GET', path: `/api/replay/audit?namespace=${sampleSpace.namespace}&entityType=event_batch&entityId=${batchId}` });
  console.log('✓ 审计日志查询成功');
  console.log('  审计记录数:', auditRes.data.length);
  auditRes.data.slice(0, 3).forEach(log => {
    console.log(`  - ${log.operation_type} by ${log.operated_by} at ${new Date(log.operated_at).toLocaleString()}`);
  });
  console.log();
  
  console.log('12. 导出数据汇总...');
  const exportSumRes = await request({ method: 'GET', path: `/api/replay/batches/${batchId}/export-summary?namespace=${sampleSpace.namespace}` });
  console.log('✓ 导出汇总查询成功');
  console.log('  载荷总数:', exportSumRes.data.payloadCount);
  console.log('  异常总数:', exportSumRes.data.exceptionCount);
  console.log('  成功率:', exportSumRes.data.successRate);
  console.log('  可导出:', exportSumRes.data.exportable ? '是' : '否');
  console.log();
  
  console.log('='.repeat(60));
  console.log('演示完成！');
  console.log('='.repeat(60));
  console.log();
  console.log('主要数据:');
  console.log('  Namespace:', sampleSpace.namespace);
  console.log('  Space ID:', spaceId);
  console.log('  Batch ID:', batchId);
  console.log();
  console.log('可用接口:');
  console.log(`  详情查询: GET /api/replay/batches/${batchId}/detail?namespace=${sampleSpace.namespace}`);
  console.log(`  数据导出: GET /api/replay/batches/${batchId}/export?namespace=${sampleSpace.namespace}&format=json`);
  console.log(`  审计日志: GET /api/replay/audit?namespace=${sampleSpace.namespace}`);
  console.log();
};

runDemo().catch(console.error);
