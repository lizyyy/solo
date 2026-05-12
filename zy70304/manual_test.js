const http = require('http');
const crypto = require('crypto');

const BASE = 'http://localhost:3000';
const SECRET = 'your_secret_key_here_change_in_production';

function sign(payload, timestamp) {
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', SECRET).update(message).digest('hex');
}

function request(options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: options.method,
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data || '{}') });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  const now = Math.floor(Date.now() / 1000);

  console.log('\n=== 1. 正常事件 - 签名有效，处理成功 ===');
  const payload1 = JSON.stringify({ order_id: 'ORD-2026-001', amount: 99.99 });
  const sig1 = sign(payload1, now);
  const res1 = await request({
    url: `${BASE}/webhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Id': 'evt-normal-001',
      'X-Provider': 'alipay',
      'X-Event-Type': 'payment.succeeded',
      'X-Timestamp': String(now),
      'X-Signature': sig1
    }
  }, payload1);
  console.log('Status:', res1.status, 'Body:', JSON.stringify(res1.body, null, 2));

  console.log('\n=== 2. 签名失败事件 ===');
  const payload2 = JSON.stringify({ order_id: 'ORD-2026-002', amount: 199.99 });
  const res2 = await request({
    url: `${BASE}/webhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Id': 'evt-sigfail-001',
      'X-Provider': 'wechat',
      'X-Event-Type': 'payment.succeeded',
      'X-Timestamp': String(now),
      'X-Signature': 'invalid_signature'
    }
  }, payload2);
  console.log('Status:', res2.status, 'Body:', JSON.stringify(res2.body, null, 2));

  console.log('\n=== 3. 重复事件 - 推送同一 ID ===');
  const res3 = await request({
    url: `${BASE}/webhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Id': 'evt-normal-001',
      'X-Provider': 'alipay',
      'X-Event-Type': 'payment.succeeded',
      'X-Timestamp': String(now),
      'X-Signature': sig1
    }
  }, payload1);
  console.log('Status:', res3.status, 'Body:', JSON.stringify(res3.body, null, 2));

  console.log('\n=== 4. 待修复事件 - 模拟业务缺失字段 (没有 tracking_number 会失败) ===');
  const payload4 = JSON.stringify({ status: 'delivered' });
  const sig4 = sign(payload4, now);
  const res4 = await request({
    url: `${BASE}/webhook`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Event-Id': 'evt-fixme-001',
      'X-Provider': 'shunfeng',
      'X-Event-Type': 'shipping.updated',
      'X-Timestamp': String(now),
      'X-Signature': sig4
    }
  }, payload4);
  console.log('Status:', res4.status, 'Body:', JSON.stringify(res4.body, null, 2));

  console.log('\n=== 5. 查看 evt-fixme-001 详情 ===');
  const res5 = await request({ url: `${BASE}/events/evt-fixme-001`, method: 'GET' });
  console.log('Status:', res5.status);
  const evt = res5.body;
  console.log('Status:', evt.status, 'Attempts:', evt.attempt_count, 'Last error:', evt.last_error);

  console.log('\n=== 6. 重放 evt-fixme-001 (business_only 模式 - 但业务逻辑还是失败因为原始 payload 没有 tracking_number) ===');
  console.log('注意：实际修复需要修改数据库中的 raw_body。这里演示重放流程。');
  const res6 = await request({
    url: `${BASE}/events/evt-fixme-001/replay`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ mode: 'business_only', actor: 'operator-li' }));
  console.log('Status:', res6.status, 'Body:', JSON.stringify(res6.body, null, 2));

  console.log('\n=== 7. 先确认 evt-normal-001 完成，再尝试重放（应该被拒绝）===');
  await request({
    url: `${BASE}/events/evt-normal-001/confirm`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ actor: 'manager-zhang' }));
  
  const res7 = await request({
    url: `${BASE}/events/evt-normal-001/replay`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ mode: 'full', actor: 'operator-li' }));
  console.log('Status:', res7.status, 'Body:', JSON.stringify(res7.body, null, 2));

  console.log('\n=== 8. 禁用 evt-sigfail-001 重放，然后尝试重放 ===');
  await request({
    url: `${BASE}/events/evt-sigfail-001/disable-replay`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ reason: '已确认测试请求', actor: 'admin' }));
  
  const res8 = await request({
    url: `${BASE}/events/evt-sigfail-001/replay`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ mode: 'verify_signature_only', actor: 'operator-li' }));
  console.log('Status:', res8.status, 'Body:', JSON.stringify(res8.body, null, 2));

  console.log('\n=== 9. 最终列表查询 ===');
  const res9 = await request({ url: `${BASE}/events`, method: 'GET' });
  console.log('Total events:', res9.body.length);
  for (const e of res9.body) {
    console.log(`  - ${e.event_id}: status=${e.status}, sig=${e.signature_valid}, ts=${e.timestamp_valid}, attempts=${e.attempt_count}`);
  }

  console.log('\n✅ 所有测试完成！');
}

test().catch(console.error);
