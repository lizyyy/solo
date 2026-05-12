const crypto = require('crypto');
const http = require('http');

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
      path: url.pathname + url.search,
      method: options.method,
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, body: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTests() {
  const now = Math.floor(Date.now() / 1000);

  console.log('\n========== 测试 1: 正常事件 - 签名有效，处理成功 ==========');
  {
    const payload = JSON.stringify({ order_id: 'ORD-NORMAL-001', amount: 99.99 });
    const sig = sign(payload, now);
    const res = await request({
      url: `${BASE}/webhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Id': 'evt-normal-001',
        'X-Provider': 'alipay',
        'X-Event-Type': 'payment.succeeded',
        'X-Timestamp': String(now),
        'X-Signature': sig
      }
    }, payload);
    console.log('HTTP Status:', res.status);
    console.log('签名有效:', res.body.signature_valid);
    console.log('时间戳有效:', res.body.timestamp_valid);
    console.log('事件状态:', res.body.event_status);
    console.log('✅ PASS' , res.body.event_status === 'success' ? '✓' : '✗');
  }

  console.log('\n========== 测试 2: 签名失败事件 ==========');
  {
    const payload = JSON.stringify({ order_id: 'ORD-SIGFAIL-001', amount: 199.99 });
    const res = await request({
      url: `${BASE}/webhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Id': 'evt-sigfail-001',
        'X-Provider': 'wechat',
        'X-Event-Type': 'payment.succeeded',
        'X-Timestamp': String(now),
        'X-Signature': 'wrong_signature_12345'
      }
    }, payload);
    console.log('HTTP Status:', res.status);
    console.log('签名有效:', res.body.signature_valid);
    console.log('事件状态:', res.body.event_status);
    console.log('✅ PASS' , res.body.event_status === 'signature_failed' ? '✓' : '✗');
  }

  console.log('\n========== 测试 3: 重复事件 ==========');
  {
    const payload = JSON.stringify({ order_id: 'ORD-NORMAL-001', amount: 99.99 });
    const sig = sign(payload, now);
    const res = await request({
      url: `${BASE}/webhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Id': 'evt-normal-001',
        'X-Provider': 'alipay',
        'X-Event-Type': 'payment.succeeded',
        'X-Timestamp': String(now),
        'X-Signature': sig
      }
    }, payload);
    console.log('HTTP Status:', res.status);
    console.log('是重复事件:', res.body.is_duplicate);
    console.log('现有状态:', res.body.existing_status);
    console.log('✅ PASS' , res.body.is_duplicate ? '✓' : '✗');
  }

  console.log('\n========== 测试 4: 业务处理失败事件（缺少必填字段） ==========');
  {
    const payload = JSON.stringify({ status: 'shipped' });
    const sig = sign(payload, now);
    const res = await request({
      url: `${BASE}/webhook`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Event-Id': 'evt-fixme-001',
        'X-Provider': 'shunfeng',
        'X-Event-Type': 'shipping.updated',
        'X-Timestamp': String(now),
        'X-Signature': sig
      }
    }, payload);
    console.log('HTTP Status:', res.status);
    console.log('签名有效:', res.body.signature_valid);
    console.log('事件状态:', res.body.event_status);
    console.log('✅ PASS' , res.body.event_status === 'failed' ? '✓' : '✗');
  }

  console.log('\n========== 测试 5: 查询事件详情 ==========');
  {
    const res = await request({
      url: `${BASE}/events/evt-fixme-001`,
      method: 'GET'
    });
    console.log('HTTP Status:', res.status);
    console.log('事件ID:', res.body.event_id);
    console.log('尝试次数:', res.body.attempt_count);
    console.log('最后错误:', res.body.last_error);
    console.log('审计记录数:', res.body.audits?.length);
    console.log('✅ PASS' , res.body.attempt_count >= 1 ? '✓' : '✗');
  }

  console.log('\n========== 测试 6: 修复后重放（business_only 模式） ==========');
  {
    const res = await request({
      url: `${BASE}/events/evt-fixme-001/replay`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ mode: 'business_only', actor: 'operator-li' }));
    console.log('HTTP Status:', res.status);
    console.log('重放模式:', res.body.mode);
    console.log('成功:', res.body.success);
    console.log('✅ 注意：这里仍然失败是因为原始 payload 缺少 tracking_number');
  }

  console.log('\n========== 测试 7: 确认完成后尝试重放（应该被拒绝） ==========');
  {
    await request({
      url: `${BASE}/events/evt-normal-001/confirm`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ actor: 'manager-zhang' }));

    const res = await request({
      url: `${BASE}/events/evt-normal-001/replay`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ mode: 'full', actor: 'operator-li' }));
    console.log('HTTP Status:', res.status);
    console.log('错误:', res.body.error);
    console.log('✅ PASS' , res.status === 409 ? '✓' : '✗');
  }

  console.log('\n========== 测试 8: 禁用重放窗口 ==========');
  {
    await request({
      url: `${BASE}/events/evt-sigfail-001/disable-replay`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ reason: '已确认是第三方测试请求', actor: 'admin' }));

    const res = await request({
      url: `${BASE}/events/evt-sigfail-001/replay`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ mode: 'verify_signature_only', actor: 'operator-li' }));
    console.log('HTTP Status:', res.status);
    console.log('错误:', res.body.error);
    console.log('✅ PASS' , res.status === 403 ? '✓' : '✗');
  }

  console.log('\n========== 测试 9: 事件列表查询 ==========');
  {
    const res = await request({
      url: `${BASE}/events`,
      method: 'GET'
    });
    console.log('HTTP Status:', res.status);
    console.log('事件总数:', res.body.length);
    for (const e of res.body) {
      console.log(`  - ${e.event_id}: status=${e.status}, sig=${e.signature_valid}, attempts=${e.attempt_count}`);
    }
    console.log('✅ PASS' , res.body.length >= 3 ? '✓' : '✗');
  }

  console.log('\n\n========== 🎉 所有测试完成！==========');
}

runTests().catch(console.error);
