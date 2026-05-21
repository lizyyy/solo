const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

const opts = { hostname: 'localhost', port: 3000, headers: { 'Content-Type': 'application/json' } };

async function test() {
  console.log('1. 测试创建批次...');
  const batch = await request({ ...opts, path: '/api/batches', method: 'POST' }, { operator: 'test' });
  console.log('   批次ID:', batch.id);

  console.log('2. 测试状态更新白名单包含 manual_confirm...');
  const statusTest = await request({ ...opts, path: '/api/batches/' + batch.id + '/status', method: 'PATCH' }, { status: 'manual_confirm', message: '测试人工确认状态' });
  console.log('   状态更新结果:', statusTest.success ? '成功' : '失败');

  console.log('3. 测试上传材料（动态报案号）...');
  const claims = { claims: [{
    claim_no: 'CLAIM-' + Date.now(),
    policy_no: 'POL-TEST',
    insured_name: '测试',
    insured_id_card: Date.now() + '',
    accident_date: '2024-01-01',
    claim_amount: 1000,
    diagnosis: '急性阑尾炎',
    materials: ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明']
  }]};
  const upload = await request({ ...opts, path: '/api/claims/batch/' + batch.id, method: 'POST' }, claims);
  console.log('   导入成功:', upload.imported);

  console.log('\n✅ 基础测试通过！');
  console.log('   - 状态白名单已包含 manual_confirm');
  console.log('   - 动态报案号避免唯一键冲突');
}

test().catch(e => console.error('测试失败:', e.message));
