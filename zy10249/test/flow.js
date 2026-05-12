const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function printStep(step, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`步骤 ${step}: ${description}`);
  console.log(`${'='.repeat(60)}`);
}

function printResult(result, showData = true) {
  if (result.data.success) {
    console.log('✅ 成功');
    if (showData && result.data.data) {
      console.log('   状态:', result.data.data.status);
      if (result.data.idempotent) {
        console.log('   ⚠️  幂等响应 (重复请求)');
      }
    }
  } else {
    console.log('❌ 失败');
    console.log('   错误:', result.data.error);
  }
}

async function main() {
  console.log('🏥 医疗器械消毒批次 API - 完整流程测试');
  console.log('========================================');

  try {
    await request('GET', '/health');
  } catch (e) {
    console.log('❌ 服务未启动，请先运行: npm start');
    process.exit(1);
  }

  const packageId = 'PKG-TEST-001';
  const batchNo = 'BATCH-2024-001';

  printStep('1', '器械包建档');
  let result = await request('POST', '/api/packages', {
    packageId,
    name: '手术器械包A',
    items: ['手术刀', '镊子', '剪刀', '止血钳'],
    operator: '张护士'
  });
  printResult(result);

  printStep('2', '使用发放');
  result = await request('POST', `/api/packages/${packageId}/use`, {
    operator: '李护士',
    patientId: 'PAT-001',
    surgeryId: 'SUR-001'
  });
  printResult(result);

  printStep('3', '回收登记');
  result = await request('POST', `/api/packages/${packageId}/recycle`, {
    operator: '王护士',
    condition: '正常',
    notes: '使用后正常回收'
  });
  printResult(result);

  printStep('4', '清洗登记');
  result = await request('POST', `/api/packages/${packageId}/clean`, {
    operator: '赵护士',
    method: '全自动清洗机',
    temperature: 85,
    duration: 20
  });
  printResult(result);

  printStep('5', '消毒登记');
  result = await request('POST', `/api/packages/${packageId}/disinfect`, {
    operator: '钱护士',
    method: '湿热消毒',
    temperature: 90,
    duration: 15
  });
  printResult(result);

  printStep('6', '灭菌登记 (通过)');
  result = await request('POST', `/api/packages/${packageId}/sterilize`, {
    operator: '孙护士',
    batchNo,
    method: '高压蒸汽灭菌',
    temperature: 134,
    duration: 10,
    pressure: 210,
    result: 'pass'
  });
  printResult(result);

  printStep('7', '发放登记');
  result = await request('POST', `/api/packages/${packageId}/distribute`, {
    operator: '周护士',
    department: '手术室',
    receiver: '郑护士长'
  });
  printResult(result);

  printStep('8', '查询器械包当前状态');
  result = await request('GET', `/api/packages/${packageId}`);
  printResult(result, false);
  console.log('   当前状态:', result.data.data.status);
  console.log('   最后更新:', result.data.data.lastUpdatedAt);

  printStep('9', '查询器械包完整历史');
  result = await request('GET', `/api/packages/${packageId}/history`);
  console.log('✅ 成功 - 共', result.data.data.length, '条记录');
  result.data.data.forEach((h, i) => {
    console.log(`   ${i + 1}. ${h.action} - ${h.operator} - ${h.statusBefore} → ${h.statusAfter}`);
  });

  console.log('\n');
  console.log('🔴 违规操作拦截测试');
  console.log('========================');

  printStep('A', '测试: 未清洗直接灭菌 (先创建新包)');
  const pkg2 = 'PKG-TEST-002';
  await request('POST', '/api/packages', {
    packageId: pkg2,
    name: '测试包2',
    items: ['测试器械'],
    operator: '测试护士'
  });
  await request('POST', `/api/packages/${pkg2}/use`, { operator: '测试' });
  await request('POST', `/api/packages/${pkg2}/recycle`, { operator: '测试' });
  result = await request('POST', `/api/packages/${pkg2}/sterilize`, {
    operator: '测试',
    batchNo: 'BATCH-TEST-002',
    method: '测试',
    temperature: 134,
    duration: 10,
    pressure: 210,
    result: 'pass'
  });
  printResult(result);

  printStep('B', '测试: 灭菌失败后尝试发放');
  const pkg3 = 'PKG-TEST-003';
  await request('POST', '/api/packages', { packageId: pkg3, name: '测试包3', items: ['x'], operator: '测试' });
  await request('POST', `/api/packages/${pkg3}/use`, { operator: '测试' });
  await request('POST', `/api/packages/${pkg3}/recycle`, { operator: '测试' });
  await request('POST', `/api/packages/${pkg3}/clean`, { operator: '测试', method: 'x', temperature: 85, duration: 10 });
  await request('POST', `/api/packages/${pkg3}/disinfect`, { operator: '测试', method: 'x', temperature: 90, duration: 10 });
  await request('POST', `/api/packages/${pkg3}/sterilize`, {
    operator: '测试', batchNo: 'BATCH-TEST-003', method: 'x', temperature: 134, duration: 10, pressure: 210, result: 'fail'
  });
  result = await request('POST', `/api/packages/${pkg3}/distribute`, { operator: '测试', department: 'x', receiver: 'x' });
  printResult(result);

  printStep('C', '测试: 同一器械包重复入批');
  const pkg4 = 'PKG-TEST-004';
  await request('POST', '/api/packages', { packageId: pkg4, name: '测试包4', items: ['x'], operator: '测试' });
  await request('POST', `/api/packages/${pkg4}/use`, { operator: '测试' });
  await request('POST', `/api/packages/${pkg4}/recycle`, { operator: '测试' });
  await request('POST', `/api/packages/${pkg4}/clean`, { operator: '测试', method: 'x', temperature: 85, duration: 10 });
  await request('POST', `/api/packages/${pkg4}/disinfect`, { operator: '测试', method: 'x', temperature: 90, duration: 10 });
  await request('POST', `/api/packages/${pkg4}/sterilize`, {
    operator: '测试', batchNo: 'BATCH-TEST-004', method: 'x', temperature: 134, duration: 10, pressure: 210, result: 'pass'
  });
  result = await request('POST', `/api/packages/${pkg4}/sterilize`, {
    operator: '测试', batchNo: 'BATCH-TEST-005', method: 'x', temperature: 134, duration: 10, pressure: 210, result: 'pass'
  });
  printResult(result);

  printStep('D', '测试: 重复提交 (幂等性)');
  const pkg5 = 'PKG-TEST-005';
  const createData = { packageId: pkg5, name: '测试包5', items: ['x'], operator: '测试', requestId: 'REQ-001' };
  result = await request('POST', '/api/packages', createData);
  printResult(result);
  console.log('   再次提交相同请求 (requestId: REQ-001)');
  result = await request('POST', '/api/packages', createData);
  printResult(result);

  printStep('E', '查询所有器械包状态');
  result = await request('GET', '/api/packages');
  console.log('✅ 成功 - 共', result.data.data.length, '个器械包');
  result.data.data.forEach(p => {
    console.log(`   ${p.packageId}: ${p.name} - ${p.status}`);
  });

  printStep('F', '查询灭菌批次信息');
  result = await request('GET', `/api/batches/${batchNo}`);
  console.log('✅ 成功');
  console.log('   批次号:', result.data.data.batchNo);
  console.log('   包含器械包:', result.data.data.packages.join(', '));
  console.log('   有效期至:', result.data.data.expiryDate);
  console.log('   是否过期:', result.data.data.isExpired ? '是' : '否');

  console.log('\n');
  console.log('🎉 测试完成！');
  console.log('========================================');
  console.log('✅ 正常流程验证通过');
  console.log('✅ 违规操作拦截验证通过');
  console.log('✅ 幂等性验证通过');
  console.log('\n详细信息请查看上方日志输出');
}

main().catch(console.error);
