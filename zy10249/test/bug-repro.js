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

async function main() {
  console.log('🐛 Bug 复现测试: 幂等缓存污染问题');
  console.log('========================================');

  const packageId = 'PKG-BUG-001';
  const batchNo = 'BATCH-BUG-001';
  const requestId = 'REQ-BUG-001';

  console.log('\n步骤 1: 创建器械包');
  await request('POST', '/api/packages', {
    packageId,
    name: 'Bug复现测试包',
    items: ['测试器械'],
    operator: '测试护士'
  });
  console.log('✅ 完成');

  console.log('\n步骤 2: 使用发放');
  await request('POST', `/api/packages/${packageId}/use`, { operator: '测试' });
  console.log('✅ 完成');

  console.log('\n步骤 3: 回收登记');
  await request('POST', `/api/packages/${packageId}/recycle`, { operator: '测试' });
  console.log('✅ 完成, 当前状态: 已回收');

  console.log('\n步骤 4: ❌ 尝试直接灭菌 (跳过清洗消毒,应该失败)');
  console.log('   关键: 使用相同的 requestId =', requestId);
  let result = await request('POST', `/api/packages/${packageId}/sterilize`, {
    operator: '测试',
    batchNo,
    method: '高压蒸汽灭菌',
    temperature: 134,
    duration: 10,
    pressure: 210,
    result: 'pass',
    requestId
  });
  console.log('   结果:', result.data.success ? '成功' : '失败');
  console.log('   错误:', result.data.error || '无');
  if (result.data.idempotent) {
    console.log('   ⚠️  幂等响应');
  }

  console.log('\n步骤 5: 完成清洗 (补做之前跳过的步骤)');
  await request('POST', `/api/packages/${packageId}/clean`, {
    operator: '测试', method: '测试', temperature: 85, duration: 10
  });
  console.log('✅ 完成, 当前状态: 已清洗');

  console.log('\n步骤 6: 完成消毒 (补做之前跳过的步骤)');
  await request('POST', `/api/packages/${packageId}/disinfect`, {
    operator: '测试', method: '测试', temperature: 90, duration: 10
  });
  console.log('✅ 完成, 当前状态: 已消毒');

  console.log('\n步骤 7: ✅ 再次尝试灭菌,使用相同 requestId');
  console.log('   期望: 应该成功执行灭菌操作');
  console.log('   Bug: 如果幂等缓存被失败请求污染，会返回 success:true 但状态不更新');
  result = await request('POST', `/api/packages/${packageId}/sterilize`, {
    operator: '测试',
    batchNo,
    method: '高压蒸汽灭菌',
    temperature: 134,
    duration: 10,
    pressure: 210,
    result: 'pass',
    requestId
  });
  console.log('   结果:', result.data.success ? '成功' : '失败');
  console.log('   idempotent:', result.data.idempotent ? '是' : '否');
  if (result.data.data) {
    console.log('   当前状态:', result.data.data.status);
  }
  if (result.data.error) {
    console.log('   错误:', result.data.error);
  }

  console.log('\n步骤 8: 验证当前真实状态');
  result = await request('GET', `/api/packages/${packageId}`);
  console.log('   真实状态:', result.data.data.status);

  console.log('\n步骤 9: 尝试发放');
  result = await request('POST', `/api/packages/${packageId}/distribute`, {
    operator: '测试', department: '手术室', receiver: '测试'
  });
  console.log('   结果:', result.data.success ? '✅ 成功' : '❌ 失败');
  if (result.data.error) {
    console.log('   错误:', result.data.error);
  }

  if (result.data.success) {
    console.log('\n🎉 测试通过! Bug已修复');
  } else {
    console.log('\n💥 Bug复现成功! 幂等缓存被失败请求污染');
    console.log('   问题: 步骤4失败后留下了success:true的缓存');
    console.log('   导致: 步骤7看起来成功，但真实状态停在"已消毒"');
    console.log('   最终: 步骤9发放失败');
  }
}

main().catch(console.error);
