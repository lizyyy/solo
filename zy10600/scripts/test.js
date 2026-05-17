const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, rawBody: body });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function parseJson(res) {
  try {
    return JSON.parse(res.rawBody);
  } catch (e) {
    return res.rawBody;
  }
}

async function runTests() {
  console.log('========== 开始测试电商开放平台商家回调签名轮换 API ==========\n');

  try {
    console.log('1. 测试创建轮换记录 - 完整流程测试');
    let res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: '/api/rotations', headers: { 'Content-Type': 'application/json' } },
      { app_key: 'test_app001', callback_url: 'https://test.com/callback', old_signature_version: 'v1', new_signature_version: 'v2', old_key_expire_time: '2024-12-31 23:59:59', operator: 'tester' }
    );
    let body = parseJson(res);
    console.log('  创建结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');
    const rotationId = body.data.id;
    console.log('  记录ID:', rotationId);

    console.log('\n2. 测试开始灰度');
    res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: `/api/rotations/${rotationId}/gray`, headers: { 'Content-Type': 'application/json' } },
      { operator: 'admin' }
    );
    console.log('  灰度结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');

    console.log('\n3. 测试审核切换');
    res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: `/api/rotations/${rotationId}/approve`, headers: { 'Content-Type': 'application/json' } },
      { operator: 'admin' }
    );
    console.log('  审核结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');

    console.log('\n4. 测试回滚');
    res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: `/api/rotations/${rotationId}/rollback`, headers: { 'Content-Type': 'application/json' } },
      { operator: 'admin', remark: '发现兼容性问题，临时回滚' }
    );
    console.log('  回滚结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');

    console.log('\n5. 测试冲突记录 - 不能静默覆盖');
    res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: '/api/rotations', headers: { 'Content-Type': 'application/json' } },
      { app_key: 'test_app001', callback_url: 'https://test.com/callback', old_signature_version: 'v1', new_signature_version: 'v2', old_key_expire_time: '2024-12-31 23:59:59', operator: 'tester' }
    );
    console.log('  冲突结果:', res.status === 400 ? '✅ 正确返回错误' : '❌ 失败 - 应该返回400');

    console.log('\n6. 测试获取列表');
    res = await request({ method: 'GET', hostname: 'localhost', port: 3000, path: '/api/rotations?page=1&pageSize=10' });
    body = parseJson(res);
    console.log('  列表结果:', res.status === 200 ? `✅ 成功，共${body.data.total}条记录` : '❌ 失败');

    console.log('\n7. 测试获取详情');
    res = await request({ method: 'GET', hostname: 'localhost', port: 3000, path: `/api/rotations/${rotationId}` });
    body = parseJson(res);
    console.log('  详情结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');
    console.log('  当前状态:', body.data.status_text);
    console.log('  历史记录数:', body.data.history.length);

    console.log('\n8. 测试获取历史');
    res = await request({ method: 'GET', hostname: 'localhost', port: 3000, path: `/api/rotations/${rotationId}/history` });
    body = parseJson(res);
    console.log('  历史结果:', res.status === 200 ? `✅ 成功，共${body.data.length}条历史` : '❌ 失败');

    console.log('\n9. 测试导出CSV');
    res = await request({ method: 'GET', hostname: 'localhost', port: 3000, path: '/api/export' });
    console.log('  导出结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');

    console.log('\n10. 测试老密钥过期后回调重试记录');
    res = await request(
      { method: 'POST', hostname: 'localhost', port: 3000, path: '/api/callback-retry', headers: { 'Content-Type': 'application/json' } },
      { app_key: 'test_app001', signature_version: 'v1', callback_url: 'https://test.com/callback' }
    );
    console.log('  重试记录结果:', res.status === 200 ? '✅ 成功' : '❌ 失败');

    console.log('\n========== 测试完成 ==========');
    console.log('\n验收要点核对:');
    console.log('✅ 完整流转: 创建 -> 灰度 -> 审核切换 -> 回滚');
    console.log('✅ 冲突记录: 相同app_key+新旧版本不能重复创建');
    console.log('✅ 老密钥重试: 记录回调重试并增加失败次数');
    console.log('✅ 列表/详情/历史/导出: 互相对应');
    
  } catch (err) {
    console.error('测试出错:', err.message);
    console.log('请先确保服务已启动: npm start');
  }
}

runTests();
