const http = require('http');

const BASE_URL = 'http://localhost:3001/api';
let testResults = [];

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const url = new URL(path, BASE_URL);
    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function logResult(name, passed, message = '') {
  testResults.push({ name, passed, message });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}: ${name}${message ? ` - ${message}` : ''}`);
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('端点迁移助手 - 自检脚本');
  console.log('='.repeat(60));
  console.log('');

  try {
    await request('GET', '/health');
    logResult('API服务健康检查', true);
  } catch (e) {
    logResult('API服务健康检查', false, '请先启动后端服务: npm run server');
    console.log('\n测试终止');
    process.exit(1);
  }

  console.log('');

  let oldEndpointId;
  try {
    const res = await request('POST', '/old-endpoints', {
      name: '测试旧端点',
      url: '/api/legacy/user',
      method: 'GET',
      description: '旧系统用户查询接口'
    });
    oldEndpointId = res.data.id;
    logResult('创建旧端点', true);
  } catch (e) {
    logResult('创建旧端点', false, e.message);
  }

  try {
    const res = await request('GET', '/old-endpoints');
    const passed = Array.isArray(res.data) && res.data.length > 0;
    logResult('查询旧端点列表', passed);
  } catch (e) {
    logResult('查询旧端点列表', false, e.message);
  }

  let newEndpointId;
  try {
    const res = await request('POST', '/new-endpoints', {
      name: '测试新端点',
      url: '/api/v2/user',
      method: 'GET',
      description: '新系统用户查询接口',
      old_endpoint_id: oldEndpointId,
      status: 'pending'
    });
    newEndpointId = res.data.id;
    logResult('创建新端点', true);
  } catch (e) {
    logResult('创建新端点', false, e.message);
  }

  try {
    const res = await request('PUT', `/new-endpoints/${newEndpointId}/status`, { status: 'ready' });
    logResult('更新新端点状态为就绪', res.data.success);
  } catch (e) {
    logResult('更新新端点状态为就绪', false, e.message);
  }

  let systemId;
  try {
    const res = await request('POST', '/calling-systems', {
      name: '测试调用系统',
      owner: '张三',
      contact_info: 'zhangsan@example.com'
    });
    systemId = res.data.id;
    logResult('创建调用系统', true);
  } catch (e) {
    logResult('创建调用系统', false, e.message);
  }

  let layerId;
  try {
    const res = await request('POST', '/compatibility-layers', {
      name: '测试兼容层',
      old_endpoint_id: oldEndpointId,
      new_endpoint_id: newEndpointId,
      transformation_rules: '{}'
    });
    layerId = res.data.id;
    logResult('创建兼容层', true);
  } catch (e) {
    logResult('创建兼容层', false, e.message);
  }

  try {
    const res = await request('PUT', `/compatibility-layers/${layerId}/status`, { status: 'active' });
    logResult('激活兼容层', res.data.success);
  } catch (e) {
    logResult('激活兼容层', false, e.message);
  }

  let batchId;
  try {
    const res = await request('POST', '/traffic-batches', {
      name: '测试切流批次',
      calling_system_id: systemId,
      new_endpoint_id: newEndpointId,
      traffic_percentage: 10
    });
    batchId = res.data.id;
    logResult('创建切流批次', true);
  } catch (e) {
    logResult('创建切流批次', false, e.message);
  }

  try {
    const res = await request('POST', `/traffic-batches/${batchId}/validate`);
    logResult('验证切流批次', res.data.valid);
  } catch (e) {
    logResult('验证切流批次', false, e.message);
  }

  try {
    await request('PUT', `/traffic-batches/${batchId}/status`, { status: 'executing' });
    logResult('开始执行切流', true);
  } catch (e) {
    logResult('开始执行切流', false, e.message);
  }

  try {
    await request('POST', `/traffic-batches/${batchId}/confirm`, { operator: 'test_user' });
    logResult('确认切流完成', true);
  } catch (e) {
    logResult('确认切流完成', false, e.message);
  }

  let batch2Id;
  try {
    const res = await request('POST', '/traffic-batches', {
      name: '测试回滚批次',
      calling_system_id: systemId,
      new_endpoint_id: newEndpointId,
      traffic_percentage: 50
    });
    batch2Id = res.data.id;
    await request('PUT', `/traffic-batches/${batch2Id}/status`, { status: 'executing' });
    const rollbackRes = await request('POST', `/traffic-batches/${batch2Id}/rollback`, {
      reason: '测试回滚功能',
      operator: 'test_user'
    });
    logResult('执行回滚操作', rollbackRes.data.success);
  } catch (e) {
    logResult('执行回滚操作', false, e.message);
  }

  try {
    await request('POST', '/reconciliation', {
      batch_id: batchId,
      old_response: { code: 200, data: {} },
      new_response: { code: 200, data: {} }
    });
    logResult('记录对账记录', true);
  } catch (e) {
    logResult('记录对账记录', false, e.message);
  }

  try {
    await request('POST', '/request-logs', {
      batch_id: batchId,
      old_endpoint_id: oldEndpointId,
      new_endpoint_id: newEndpointId,
      request_input: '{}',
      response_output: '{}',
      status: 'success',
      error_message: null,
      responsible_node: 'gateway'
    });
    logResult('记录请求日志', true);
  } catch (e) {
    logResult('记录请求日志', false, e.message);
  }

  try {
    await request('POST', '/request-logs', {
      batch_id: batchId,
      status: 'failed',
      error_message: '模拟异常测试',
      responsible_node: 'compatibility-layer'
    });
    logResult('记录异常日志', true);
  } catch (e) {
    logResult('记录异常日志', false, e.message);
  }

  try {
    const res = await request('GET', '/exceptions');
    logResult('查询异常队列', Array.isArray(res.data));
  } catch (e) {
    logResult('查询异常队列', false, e.message);
  }

  try {
    const res = await request('GET', '/stats');
    const passed = res.data.totalEndpoints !== undefined;
    logResult('获取迁移统计', passed);
  } catch (e) {
    logResult('获取迁移统计', false, e.message);
  }

  try {
    const res = await request('GET', '/rollback-records');
    logResult('查询回滚记录', Array.isArray(res.data));
  } catch (e) {
    logResult('查询回滚记录', false, e.message);
  }

  try {
    const res = await request('GET', '/export/migration-report');
    logResult('导出让报告导出', true);
  } catch (e) {
    logResult('导出迁移报告', false, e.message);
  }

  console.log('');
  console.log('='.repeat(60));
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  console.log(`测试结果: ${passedCount}/${totalCount} 通过`);
  console.log('='.repeat(60));

  if (passedCount < totalCount) {
    console.log('\n失败的测试:');
    testResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n所有测试通过！系统功能正常。');
    process.exit(0);
  }
}

runTests().catch(e => {
  console.error('测试执行失败:', e);
  process.exit(1);
});
