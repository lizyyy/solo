import http from 'http';

const BASE_URL = 'http://localhost:3001/api';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, data, error: e.message });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function makeRequest(method, path, body = null) {
  const fullPath = BASE_URL + path;
  const url = new URL(fullPath);
  return request({
    hostname: url.hostname,
    port: url.port || 3001,
    path: url.pathname + url.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
    }
  }, body);
}

async function test(name, fn) {
  console.log(`\n📋 ${name}`);
  console.log('─'.repeat(50));
  try {
    await fn();
    console.log('✅ PASS');
  } catch (e) {
    console.log(`❌ FAIL: ${e.message}`);
  }
}

async function runTests() {
  console.log('========================================');
  console.log('  乡村快递共配结算台 - API测试');
  console.log('========================================');

  await test('健康检查', async () => {
    const res = await makeRequest('GET', '/health');
    console.log('状态码:', res.status);
    console.log('响应:', res.data);
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('获取快递公司列表', async () => {
    const res = await makeRequest('GET', '/courier-companies');
    console.log('数量:', res.data.length);
    console.log('数据:', res.data.slice(0, 2));
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('获取滞留规则列表', async () => {
    const res = await makeRequest('GET', '/retention-rules');
    console.log('数量:', res.data.length);
    console.log('数据:', res.data);
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('获取包裹列表', async () => {
    const res = await makeRequest('GET', '/packages');
    console.log('数量:', res.data.length);
    console.log('数据:', res.data.slice(0, 2));
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('获取包裹统计', async () => {
    const res = await makeRequest('GET', '/packages/stats');
    console.log('统计:', res.data);
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('扫描包裹 - 正常', async () => {
    const res = await makeRequest('POST', '/packages/scan', { tracking_number: 'YT2345678901' });
    console.log('状态码:', res.status);
    console.log('包裹:', res.data?.tracking_number, res.data?.status);
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('扫描包裹 - 不存在 (异常测试)', async () => {
    const res = await makeRequest('POST', '/packages/scan', { tracking_number: 'NOTEXIST000' });
    console.log('状态码:', res.status);
    console.log('错误信息:', res.data?.error);
    if (res.status !== 404) throw new Error(`预期404，实际${res.status}`);
    console.log('✅ 正确返回404');
  });

  await test('创建包裹 - 正常', async () => {
    const companies = await makeRequest('GET', '/courier-companies');
    const companyId = companies.data[0].id;
    
    const uniqueNum = `TEST${Date.now()}`;
    const res = await makeRequest('POST', '/packages', {
      tracking_number: uniqueNum,
      courier_company_id: companyId,
      recipient_name: '测试用户',
      recipient_phone: '13800000000'
    });
    console.log('状态码:', res.status);
    console.log('创建的包裹:', res.data?.tracking_number);
    if (res.status !== 201) throw new Error(`预期201，实际${res.status}`);
  });

  await test('创建包裹 - 重复运单号 (异常测试)', async () => {
    const res = await makeRequest('POST', '/packages', {
      tracking_number: 'YT2345678901',
      courier_company_id: 1,
      recipient_name: '重复测试'
    });
    console.log('状态码:', res.status);
    console.log('错误信息:', res.data?.error);
    if (res.status !== 400) throw new Error(`预期400，实际${res.status}`);
    console.log('✅ 正确返回400 - 运单号重复');
  });

  await test('创建快递公司 - 正常', async () => {
    const uniqueCode = `TEST${Math.floor(Math.random() * 10000)}`;
    const res = await makeRequest('POST', '/courier-companies', {
      name: '测试快递',
      code: uniqueCode,
      delivery_fee: 1.2,
      return_fee: 2.5,
      storage_fee_per_day: 0.6
    });
    console.log('状态码:', res.status);
    console.log('创建的公司:', res.data?.name, res.data?.code);
    if (res.status !== 201) throw new Error(`预期201，实际${res.status}`);
  });

  await test('创建快递公司 - 重复编码 (异常测试)', async () => {
    const res = await makeRequest('POST', '/courier-companies', {
      name: '重复测试',
      code: 'SF',
      delivery_fee: 1,
      return_fee: 2,
      storage_fee_per_day: 0.5
    });
    console.log('状态码:', res.status);
    console.log('错误信息:', res.data?.error);
    if (res.status !== 400) throw new Error(`预期400，实际${res.status}`);
    console.log('✅ 正确返回400 - 公司编码重复');
  });

  await test('获取结算统计', async () => {
    const res = await makeRequest('GET', '/settlements/stats');
    console.log('统计:', res.data);
    if (res.status !== 200) throw new Error(`预期200，实际${res.status}`);
  });

  await test('创建结算单 - 日期异常 (异常测试)', async () => {
    const res = await makeRequest('POST', '/settlements', {
      courier_company_id: 1,
      start_date: '2026-05-10',
      end_date: '2026-05-01'
    });
    console.log('状态码:', res.status);
    console.log('错误信息:', res.data?.error);
    if (res.status !== 400) throw new Error(`预期400，实际${res.status}`);
    console.log('✅ 正确返回400 - 日期范围错误');
  });

  console.log('\n========================================');
  console.log('  测试完成！');
  console.log('========================================\n');
}

runTests().catch(console.error);
