const http = require('http');

const API_BASE = 'http://localhost:3001/api/leads';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testSuccessCase() {
  console.log('\n========================================');
  console.log('测试 1: 成功导入（无重复）');
  console.log('========================================');
  
  const result = await request(API_BASE, {
    method: 'POST',
    body: {
      name: '陈成功',
      phone: '18800008888',
      email: 'chen@success.com',
      company: '成功科技',
      source: 'website',
      source_id: 'test_success_001'
    }
  });

  console.log('状态码:', result.status);
  console.log('响应:', JSON.stringify(result.data, null, 2));
  
  if (result.data.status === 'accepted') {
    console.log('✅ 测试通过: 新线索自动通过');
  } else {
    console.log('❌ 测试失败: 状态不正确');
  }
  
  return result.data.lead?.id;
}

async function testDuplicateCase() {
  console.log('\n========================================');
  console.log('测试 2: 发现重复线索');
  console.log('========================================');

  const result = await request(API_BASE, {
    method: 'POST',
    body: {
      name: '张重复',
      phone: '13800138001',
      email: 'zhang@duplicate.com',
      company: '重复公司',
      source: 'event',
      source_id: 'test_dup_001'
    }
  });

  console.log('状态码:', result.status);
  console.log('响应:', JSON.stringify(result.data, null, 2));
  
  if (result.data.status === 'needs_review') {
    console.log('✅ 测试通过: 发现重复，需要人工复核');
  } else {
    console.log('❌ 测试失败: 状态不正确');
  }
  
  return result.data.lead?.id;
}

async function testDuplicateRequestCase() {
  console.log('\n========================================');
  console.log('测试 3: 重复请求幂等性');
  console.log('========================================');

  const requestId = 'test-idempotent-' + Date.now();
  
  const result1 = await request(API_BASE, {
    method: 'POST',
    headers: { 'x-request-id': requestId },
    body: {
      name: '幂等测试',
      phone: '17700007777',
      email: 'idempotent@test.com',
      company: '幂等公司',
      source: 'crm',
      source_id: 'test_idemp_001'
    }
  });

  console.log('第一次请求:', result1.status);

  const result2 = await request(API_BASE, {
    method: 'POST',
    headers: { 'x-request-id': requestId },
    body: {
      name: '幂等测试',
      phone: '17700007777',
      email: 'idempotent@test.com',
      company: '幂等公司',
      source: 'crm',
      source_id: 'test_idemp_001'
    }
  });

  console.log('第二次请求（相同 request-id）:', result2.status);
  console.log('响应:', JSON.stringify(result2.data, null, 2));
  
  if (result2.data.isDuplicateRequest) {
    console.log('✅ 测试通过: 重复请求正确识别');
  } else {
    console.log('❌ 测试失败: 幂等性未生效');
  }
}

async function testValidationErrorCase() {
  console.log('\n========================================');
  console.log('测试 4: 验证失败（缺少手机号和邮箱）');
  console.log('========================================');

  const result = await request(API_BASE, {
    method: 'POST',
    body: {
      name: '无联系方式',
      company: '测试公司',
      source: 'website'
    }
  });

  console.log('状态码:', result.status);
  console.log('响应:', JSON.stringify(result.data, null, 2));
  
  if (result.status === 400 && result.data.error === 'VALIDATION_ERROR') {
    console.log('✅ 测试通过: 验证错误正确返回');
  } else {
    console.log('❌ 测试失败: 验证未生效');
  }
}

async function testGetLeadDetail(leadId) {
  console.log('\n========================================');
  console.log('测试 5: 获取线索详情');
  console.log('========================================');

  const result = await request(`${API_BASE}/${leadId}`);
  
  console.log('状态码:', result.status);
  console.log('线索基本信息:', JSON.stringify(result.data.data?.lead, null, 2));
  console.log('重复候选数量:', result.data.data?.duplicates?.length);
  console.log('处理日志数量:', result.data.data?.logs?.length);
  
  if (result.status === 200) {
    console.log('✅ 测试通过: 详情查询成功');
  }
}

async function testGetStats() {
  console.log('\n========================================');
  console.log('测试 6: 获取统计信息');
  console.log('========================================');

  const result = await request(`${API_BASE}/stats`);
  
  console.log('状态码:', result.status);
  console.log('统计数据:', JSON.stringify(result.data.data, null, 2));
  
  if (result.status === 200) {
    console.log('✅ 测试通过: 统计查询成功');
  }
}

async function runAllTests() {
  console.log('开始运行测试样例...\n');
  
  try {
    await request('http://localhost:3001/api/health');
    console.log('✅ 服务健康检查通过\n');
  } catch (e) {
    console.log('❌ 无法连接到服务，请先启动后端服务');
    console.log('运行: cd backend && npm start');
    process.exit(1);
  }

  const id1 = await testSuccessCase();
  const id2 = await testDuplicateCase();
  await testDuplicateRequestCase();
  await testValidationErrorCase();
  
  if (id2) {
    await testGetLeadDetail(id2);
  }
  
  await testGetStats();

  console.log('\n========================================');
  console.log('所有测试完成!');
  console.log('========================================');
  console.log('\n提示:');
  console.log('- 需要人工复核的线索 ID:', id2);
  console.log('- 可以启动前端查看详细信息并执行复核操作');
}

runAllTests().catch(console.error);
