const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              body: data ? JSON.parse(data) : null
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              body: data
            });
          }
        });
      }
    );

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== 邮件退信处理 API 测试 ===\n');

  const msgId1 = 'msg_001_' + Date.now();
  const msgId2 = 'msg_002_' + Date.now();
  const bounceId1 = 'bounce_001_' + Date.now();
  const bounceId2 = 'bounce_002_' + Date.now();

  console.log('--- 测试 1: 创建发送记录 ---');
  const send1 = await request({
    path: '/api/sends',
    method: 'POST'
  }, {
    id: 'send_001',
    email: 'user1@example.com',
    business_type: 'marketing',
    subject: '促销活动',
    message_id: msgId1
  });
  console.log('发送记录创建:', send1.statusCode, JSON.stringify(send1.body, null, 2));

  console.log('\n--- 测试 2: 检查发送决策 (初始状态) ---');
  const canSend1 = await request({
    path: '/api/can-send/user1@example.com?business_type=marketing',
    method: 'GET'
  });
  console.log('发送决策:', canSend1.statusCode, JSON.stringify(canSend1.body, null, 2));

  console.log('\n--- 测试 3: 处理软退信事件 ---');
  const softBounce = await request({
    path: '/api/bounces',
    method: 'POST'
  }, {
    id: bounceId1,
    email: 'user1@example.com',
    type: 'soft',
    reason: '邮箱临时不可用，请稍后重试',
    message_id: msgId1
  });
  console.log('软退信处理:', softBounce.statusCode, JSON.stringify(softBounce.body, null, 2));

  console.log('\n--- 测试 4: 检查发送决策 (软退后) ---');
  const canSend2 = await request({
    path: '/api/can-send/user1@example.com?business_type=marketing',
    method: 'GET'
  });
  console.log('发送决策 (软退后):', canSend2.statusCode, JSON.stringify(canSend2.body, null, 2));

  console.log('\n--- 测试 5: 重复推送同一退信事件 (幂等性) ---');
  const duplicateBounce = await request({
    path: '/api/bounces',
    method: 'POST'
  }, {
    id: bounceId1,
    email: 'user1@example.com',
    type: 'soft',
    reason: '邮箱临时不可用，请稍后重试',
    message_id: msgId1
  });
  console.log('重复推送处理:', duplicateBounce.statusCode, JSON.stringify(duplicateBounce.body, null, 2));

  console.log('\n--- 测试 6: 处理硬退信事件 ---');
  const hardBounce = await request({
    path: '/api/bounces',
    method: 'POST'
  }, {
    id: bounceId2,
    email: 'invalid@test.com',
    type: 'hard',
    reason: '550 5.1.1 User unknown',
    message_id: msgId2
  });
  console.log('硬退信处理:', hardBounce.statusCode, JSON.stringify(hardBounce.body, null, 2));

  console.log('\n--- 测试 7: 检查硬退信后的营销邮件发送决策 ---');
  const canSend3 = await request({
    path: '/api/can-send/invalid@test.com?business_type=marketing',
    method: 'GET'
  });
  console.log('营销邮件决策:', canSend3.statusCode, JSON.stringify(canSend3.body, null, 2));

  console.log('\n--- 测试 8: 检查硬退信后的账单邮件发送决策 ---');
  const canSend4 = await request({
    path: '/api/can-send/invalid@test.com?business_type=billing',
    method: 'GET'
  });
  console.log('账单邮件决策:', canSend4.statusCode, JSON.stringify(canSend4.body, null, 2));

  console.log('\n--- 测试 9: 处理退订事件 ---');
  const unsubscribeBounce = await request({
    path: '/api/bounces',
    method: 'POST'
  }, {
    id: 'bounce_003_' + Date.now(),
    email: 'unsubscribed@user.com',
    type: 'complaint',
    reason: 'User requested unsubscribe'
  });
  console.log('退订处理:', unsubscribeBounce.statusCode, JSON.stringify(unsubscribeBounce.body, null, 2));

  console.log('\n--- 测试 10: 检查退订用户发送决策 ---');
  const canSend5 = await request({
    path: '/api/can-send/unsubscribed@user.com?business_type=marketing',
    method: 'GET'
  });
  console.log('退订用户决策:', canSend5.statusCode, JSON.stringify(canSend5.body, null, 2));

  console.log('\n--- 测试 11: 查询地址状态 ---');
  const addrStatus = await request({
    path: '/api/addresses/user1@example.com',
    method: 'GET'
  });
  console.log('地址状态:', addrStatus.statusCode, JSON.stringify(addrStatus.body, null, 2));

  console.log('\n--- 测试 12: 查询投递质量报告 ---');
  const report = await request({
    path: '/api/delivery-quality',
    method: 'GET'
  });
  console.log('投递质量报告:', report.statusCode, JSON.stringify(report.body, null, 2));

  console.log('\n=== 测试完成 ===');
}

runTests().catch(console.error);
