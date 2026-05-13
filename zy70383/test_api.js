const http = require('http');

function request(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path: url,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : {}
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('事件订阅权限 API 完整测试');
  console.log('='.repeat(60));
  
  console.log('\n【场景 1】获取事件目录 - cust_003 (enterprise套餐)');
  console.log('-'.repeat(60));
  const events3 = await request('GET', '/api/events?customerId=cust_003');
  console.log(`状态码: ${events3.statusCode}`);
  console.log('企业套餐可订阅所有事件，包括 member.*');
  console.log(JSON.stringify(events3.body, null, 2));
  
  console.log('\n【场景 2】获取事件目录 - cust_001 (basic套餐)');
  console.log('-'.repeat(60));
  const events1 = await request('GET', '/api/events?customerId=cust_001');
  console.log(`状态码: ${events1.statusCode}`);
  console.log('基础套餐只能订阅 order.* 中的部分事件，不能订阅 refund.* 和 member.*');
  const basicEvents = events1.body.data.allEvents.filter(e => e.availableForCustomer).map(e => e.eventId);
  const notAllowedEvents = events1.body.data.allEvents.filter(e => !e.availableForCustomer).map(e => e.eventId);
  console.log(`可订阅事件: ${basicEvents.join(', ')}`);
  console.log(`不可订阅事件: ${notAllowedEvents.join(', ')}`);
  
  console.log('\n【场景 3】有权限订阅 - cust_003 订阅 order.created');
  console.log('-'.repeat(60));
  const sub1 = await request('POST', '/api/subscriptions', {
    customerId: 'cust_003',
    eventId: 'order.created',
    callbackUrl: 'https://example.com/webhook',
    tenants: ['tenant_a', 'tenant_b']
  });
  console.log(`状态码: ${sub1.statusCode}`);
  console.log('订阅应该成功，状态为 pending_verification');
  console.log(JSON.stringify(sub1.body, null, 2));
  
  const subId1 = sub1.body.subscription.subscriptionId;
  const token1 = sub1.body.verificationToken;
  
  console.log('\n【场景 4】无权限订阅 - cust_001 (basic) 尝试订阅 member.created');
  console.log('-'.repeat(60));
  const sub2 = await request('POST', '/api/subscriptions', {
    customerId: 'cust_001',
    eventId: 'member.created',
    callbackUrl: 'https://example.com/webhook',
    tenants: ['tenant_a']
  });
  console.log(`状态码: ${sub2.statusCode}`);
  console.log('订阅应该失败，因为 basic 套餐无权限订阅 member.*');
  console.log(JSON.stringify(sub2.body, null, 2));
  
  console.log('\n【场景 5】订阅范围超过授权租户 - cust_001 尝试订阅 tenant_b');
  console.log('-'.repeat(60));
  const sub3 = await request('POST', '/api/subscriptions', {
    customerId: 'cust_001',
    eventId: 'order.created',
    callbackUrl: 'https://example.com/webhook',
    tenants: ['tenant_a', 'tenant_b']
  });
  console.log(`状态码: ${sub3.statusCode}`);
  console.log('订阅应该失败，因为 cust_001 只有 tenant_a 的权限');
  console.log(JSON.stringify(sub3.body, null, 2));
  
  console.log('\n【场景 6】同一事件重复订阅 - cust_003 再次订阅 order.created');
  console.log('-'.repeat(60));
  const sub4 = await request('POST', '/api/subscriptions', {
    customerId: 'cust_003',
    eventId: 'order.created',
    callbackUrl: 'https://example.com/webhook2',
    tenants: ['tenant_a']
  });
  console.log(`状态码: ${sub4.statusCode}`);
  console.log('订阅应该失败，因为已存在订阅（即使状态是 pending_verification）');
  console.log(JSON.stringify(sub4.body, null, 2));
  
  console.log('\n【场景 7】回调验证 - 使用正确的 token');
  console.log('-'.repeat(60));
  const verify1 = await request('POST', '/api/subscriptions/verify', {
    customerId: 'cust_003',
    eventId: 'order.created',
    token: token1
  });
  console.log(`状态码: ${verify1.statusCode}`);
  console.log('验证应该成功，订阅状态变为 enabled');
  console.log(JSON.stringify(verify1.body, null, 2));
  
  console.log('\n【场景 8】创建另一个订阅，用于测试验证失败');
  console.log('-'.repeat(60));
  const sub5 = await request('POST', '/api/subscriptions', {
    customerId: 'cust_003',
    eventId: 'order.paid',
    callbackUrl: 'https://example.com/webhook2',
    tenants: ['tenant_a']
  });
  console.log(`状态码: ${sub5.statusCode}`);
  console.log('订阅创建成功');
  
  const subId2 = sub5.body.subscription.subscriptionId;
  
  console.log('\n【场景 9】回调验证失败 - 使用错误的 token');
  console.log('-'.repeat(60));
  const verify2 = await request('POST', '/api/subscriptions/verify', {
    customerId: 'cust_003',
    eventId: 'order.paid',
    token: 'wrong_token_12345'
  });
  console.log(`状态码: ${verify2.statusCode}`);
  console.log('验证应该失败，订阅状态变为 verification_failed');
  console.log(JSON.stringify(verify2.body, null, 2));
  
  console.log('\n【场景 10】触发事件，测试投递统计');
  console.log('-'.repeat(60));
  const trigger1 = await request('POST', '/api/test-trigger', {
    eventId: 'order.created',
    tenantId: 'tenant_a',
    eventData: { orderId: 'ORD_001', amount: 100 }
  });
  console.log(`状态码: ${trigger1.statusCode}`);
  console.log('事件触发成功，应该投递给 cust_003 的已启用订阅');
  console.log(JSON.stringify(trigger1.body, null, 2));
  
  console.log('\n【场景 11】查看投递统计');
  console.log('-'.repeat(60));
  const stats1 = await request('GET', `/api/stats?subscriptionId=${subId1}`);
  console.log(`状态码: ${stats1.statusCode}`);
  console.log('应该显示至少1次投递');
  console.log(JSON.stringify(stats1.body, null, 2));
  
  console.log('\n【场景 12】暂停订阅');
  console.log('-'.repeat(60));
  const pause1 = await request('POST', '/api/subscriptions/pause', {
    customerId: 'cust_003',
    eventId: 'order.created',
    reason: '系统维护，暂停接收事件'
  });
  console.log(`状态码: ${pause1.statusCode}`);
  console.log('暂停成功，状态变为 paused');
  console.log(JSON.stringify(pause1.body, null, 2));
  
  console.log('\n【场景 13】暂停期间触发事件（验证不投递）');
  console.log('-'.repeat(60));
  const trigger2 = await request('POST', '/api/test-trigger', {
    eventId: 'order.created',
    tenantId: 'tenant_a',
    eventData: { orderId: 'ORD_002', amount: 200 }
  });
  console.log(`状态码: ${trigger2.statusCode}`);
  console.log('订阅已暂停，应该被跳过，不实际投递');
  console.log(JSON.stringify(trigger2.body, null, 2));
  
  console.log('\n【场景 14】暂停后查看统计（验证 pausedDeliveriesSkipped 增长）');
  console.log('-'.repeat(60));
  const stats2 = await request('GET', `/api/stats?subscriptionId=${subId1}`);
  console.log(`状态码: ${stats2.statusCode}`);
  console.log('pausedDeliveriesSkipped 应该增加1');
  console.log(JSON.stringify(stats2.body, null, 2));
  
  console.log('\n【场景 15】恢复订阅');
  console.log('-'.repeat(60));
  const resume1 = await request('POST', '/api/subscriptions/resume', {
    customerId: 'cust_003',
    eventId: 'order.created',
    reason: '系统维护完成，恢复接收事件'
  });
  console.log(`状态码: ${resume1.statusCode}`);
  console.log('恢复成功，状态变为 enabled');
  console.log(JSON.stringify(resume1.body, null, 2));
  
  console.log('\n【场景 16】恢复后触发事件');
  console.log('-'.repeat(60));
  const trigger3 = await request('POST', '/api/test-trigger', {
    eventId: 'order.created',
    tenantId: 'tenant_a',
    eventData: { orderId: 'ORD_003', amount: 300 }
  });
  console.log(`状态码: ${trigger3.statusCode}`);
  console.log('订阅已恢复，应该正常投递');
  console.log(JSON.stringify(trigger3.body, null, 2));
  
  console.log('\n【场景 17】最终统计（验证暂停期间没有投递）');
  console.log('-'.repeat(60));
  const stats3 = await request('GET', `/api/stats?subscriptionId=${subId1}`);
  console.log(`状态码: ${stats3.statusCode}`);
  console.log('最终统计验证：');
  const s3 = stats3.body.data;
  console.log(`  - 总投递次数: ${s3.totalDeliveries} (应该是2，不是3，因为暂停期间跳过了1次)`);
  console.log(`  - 暂停跳过次数: ${s3.pausedDeliveriesSkipped} (应该是1)`);
  console.log('这证明暂停期间没有继续给客户推送事件');
  console.log(JSON.stringify(stats3.body, null, 2));
  
  console.log('\n【场景 18】查看正在投递的事件');
  console.log('-'.repeat(60));
  const eventsFinal = await request('GET', '/api/events?customerId=cust_003');
  console.log(`状态码: ${eventsFinal.statusCode}`);
  console.log('当前正在投递的事件：');
  console.log(JSON.stringify(eventsFinal.body.data.activelyDeliveringEvents, null, 2));
  
  console.log('\n【场景 19】解释订阅失败原因');
  console.log('-'.repeat(60));
  const explain1 = await request('GET', '/api/subscriptions/failure-explain?customerId=cust_001&eventId=member.created');
  console.log(`状态码: ${explain1.statusCode}`);
  console.log('解释 cust_001 为什么无法订阅 member.created：');
  console.log(JSON.stringify(explain1.body, null, 2));
  
  console.log('\n【场景 20】解释回调验证失败原因');
  console.log('-'.repeat(60));
  const explain2 = await request('GET', '/api/subscriptions/failure-explain?customerId=cust_003&eventId=order.paid');
  console.log(`状态码: ${explain2.statusCode}`);
  console.log('解释 order.paid 订阅为什么失败：');
  console.log(JSON.stringify(explain2.body, null, 2));
  
  console.log('\n【场景 21】查看客户所有订阅');
  console.log('-'.repeat(60));
  const subsList = await request('GET', '/api/subscriptions?customerId=cust_003');
  console.log(`状态码: ${subsList.statusCode}`);
  console.log('cust_003 的所有订阅（显示不同状态）：');
  for (const sub of subsList.body.data) {
    console.log(`  - ${sub.eventId}: ${sub.status}`);
  }
  console.log(JSON.stringify(subsList.body, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成！');
  console.log('='.repeat(60));
  
  console.log('\n\n' + '='.repeat(60));
  console.log('Curl 示例');
  console.log('='.repeat(60));
  
  console.log('\n【1. 获取事件目录】');
  console.log(`curl --noproxy 127.0.0.1 'http://127.0.0.1:3000/api/events?customerId=cust_003'`);
  
  console.log('\n【2. 有权限订阅 - cust_003 订阅 order.created】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_003",`);
  console.log(`    "eventId": "order.created",`);
  console.log(`    "callbackUrl": "https://example.com/webhook",`);
  console.log(`    "tenants": ["tenant_a", "tenant_b"]`);
  console.log(`  }'`);
  
  console.log('\n【3. 无权限拒绝 - cust_001 (basic) 尝试订阅 member.created】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_001",`);
  console.log(`    "eventId": "member.created",`);
  console.log(`    "callbackUrl": "https://example.com/webhook",`);
  console.log(`    "tenants": ["tenant_a"]`);
  console.log(`  }'`);
  console.log('\\n预期结果：403，错误信息说明套餐权限不足');
  
  console.log('\n【4. 验证回调（使用正确token）】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions/verify' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_003",`);
  console.log(`    "eventId": "order.created",`);
  console.log(`    "token": "实际返回的verificationToken"`);
  console.log(`  }'`);
  
  console.log('\n【5. 回调验证失败（使用错误token）】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions/verify' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_003",`);
  console.log(`    "eventId": "order.created",`);
  console.log(`    "token": "wrong_token"`);
  console.log(`  }'`);
  console.log('\\n预期结果：400，订阅状态变为 verification_failed');
  
  console.log('\n【6. 暂停订阅】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions/pause' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_003",`);
  console.log(`    "eventId": "order.created",`);
  console.log(`    "reason": "系统维护"`);
  console.log(`  }'`);
  
  console.log('\n【7. 恢复订阅】');
  console.log(`curl --noproxy 127.0.0.1 -X POST 'http://127.0.0.1:3000/api/subscriptions/resume' \\`);
  console.log(`  -H 'Content-Type: application/json' \\`);
  console.log(`  -d '{`);
  console.log(`    "customerId": "cust_003",`);
  console.log(`    "eventId": "order.created",`);
  console.log(`    "reason": "维护完成"`);
  console.log(`  }'`);
  
  console.log('\n【8. 查询投递统计（验证暂停期间不投递）】');
  console.log(`curl --noproxy 127.0.0.1 'http://127.0.0.1:3000/api/stats?subscriptionId=实际subscriptionId'`);
  console.log('\\n验证点：');
  console.log('  - totalDeliveries: 暂停期间的事件不会增加');
  console.log('  - pausedDeliveriesSkipped: 暂停期间触发的事件会增加此计数');
  console.log('  - 这证明暂停期间没有给客户推送事件，但保留了统计');
  
  console.log('\n【9. 解释订阅失败原因】');
  console.log(`curl --noproxy 127.0.0.1 'http://127.0.0.1:3000/api/subscriptions/failure-explain?customerId=cust_001&eventId=member.created'`);
  
  console.log('\n【10. 查看正在投递的事件】');
  console.log(`curl --noproxy 127.0.0.1 'http://127.0.0.1:3000/api/events?customerId=cust_003'`);
  console.log('\\n在返回结果的 activelyDeliveringEvents 字段中查看当前正在投递的事件');
  
  console.log('\n');
}

runTests().catch(console.error);
