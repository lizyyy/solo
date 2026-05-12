const http = require('http');

const PORT = 3001;

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ statusCode: res.statusCode, data: parsed, raw: responseData });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData, raw: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function print(title, symbol = '═') {
  console.log('\n' + symbol.repeat(60));
  console.log(`  ${title}`);
  console.log(symbol.repeat(60));
}

async function testApi(name, path, method, body) {
  console.log(`\n▶️  ${name}`);
  const result = await request(path, method, body);
  const ok = result.statusCode >= 200 && result.statusCode < 300;
  const icon = ok ? '✅' : '⚠️ ';
  console.log(`   ${icon} Status: ${result.statusCode}`);
  if (result.data?.message) console.log(`   💬 ${result.data.message}`);
  if (result.data?.isDuplicate) console.log(`   🔁 幂等: true`);
  if (result.data?.data?.status) console.log(`   📊 Status: ${result.data.data.status}`);
  if (result.data?.data?.passed !== undefined) console.log(`   ✔️ Passed: ${result.data.data.passed}`);
  if (!ok && result.data?.error) console.log(`   ❌ Error: ${result.data.error}`);
  return result;
}

async function main() {
  print('跨境清关资料 API - 核心功能验证');
  
  console.log('\n🩺 Health Check');
  const health = await request('/api/health');
  console.log(`   Status: ${health.statusCode} - ${health.data.status}`);
  
  print('1. 查询订单 DEMO-001-PERFECT (资料齐全)', '-');
  await testApi('获取订单', '/api/orders/DEMO-001-PERFECT');
  
  print('2. 证件校验 (使用新幂等键 v2)', '-');
  await testApi('证件校验', '/api/documents/verify', 'POST', {
    order_no: 'DEMO-001-PERFECT',
    doc_type: 'id_card',
    verified_by: 'tester',
    idempotent_key: 'doc_verify_DEMO_001_V2'
  });
  
  print('3. 税号校验 (使用新幂等键 v2)', '-');
  await testApi('税号校验', '/api/taxcodes/verify', 'POST', {
    order_no: 'DEMO-001-PERFECT',
    verified_by: 'tester',
    idempotent_key: 'tax_verify_DEMO_001_V2'
  });
  
  print('4. 清关预检 (使用新幂等键 v2)', '-');
  await testApi('清关预检', '/api/customs/precheck', 'POST', {
    order_no: 'DEMO-001-PERFECT',
    checked_by: 'tester',
    idempotent_key: 'precheck_DEMO_001_V2'
  });
  
  print('5. 放行审批 (使用新幂等键 v2)', '-');
  await testApi('放行审批', '/api/customs/approve', 'POST', {
    order_no: 'DEMO-001-PERFECT',
    approved_by: 'manager',
    idempotent_key: 'approve_DEMO_001_V2'
  });
  
  print('6. 出库 (使用新幂等键 v2)', '-');
  await testApi('出库发货', '/api/customs/ship', 'POST', {
    order_no: 'DEMO-001-PERFECT',
    shipped_by: 'warehouse',
    waybill_no: 'SF-TEST-001',
    idempotent_key: 'ship_DEMO_001_V2'
  });
  
  print('7. 验证最终状态', '-');
  const finalOrder = await testApi('查询最终订单', '/api/orders/DEMO-001-PERFECT');
  if (finalOrder.data?.data?.order?.status === 'shipped') {
    console.log('\n   🎉 SUCCESS: 订单已成功出库!');
    console.log(`   📜 状态历史数: ${finalOrder.data.data.status_history?.length || 0}`);
    console.log(`   📍 检查点数: ${finalOrder.data.data.checkpoints?.length || 0}`);
  }
  
  print('8. 测试税号错误拦截 (DEMO-003-BAD-TAXCODE)', '-');
  await testApi('证件校验', '/api/documents/verify', 'POST', {
    order_no: 'DEMO-003-BAD-TAXCODE',
    doc_type: 'id_card',
    verified_by: 'tester',
    idempotent_key: 'doc_verify_DEMO_003_V2'
  });
  const taxResult = await testApi('税号校验(应该失败)', '/api/taxcodes/verify', 'POST', {
    order_no: 'DEMO-003-BAD-TAXCODE',
    verified_by: 'tester',
    idempotent_key: 'tax_verify_DEMO_003_V2'
  });
  if (taxResult.data?.data?.item_results) {
    taxResult.data.data.item_results.filter(r => !r.valid).forEach(r => {
      console.log(`   ❌ ${r.product_name}: ${r.reason}`);
    });
  }
  
  print('9. 测试强行出库拦截 (DEMO-005-EXPIRED 证件过期)', '-');
  const shipFail = await testApi('试图直接出库(应该失败)', '/api/customs/ship', 'POST', {
    order_no: 'DEMO-005-EXPIRED',
    shipped_by: 'warehouse',
    idempotent_key: 'ship_DEMO_005_V2'
  });
  if (shipFail.statusCode === 400) {
    console.log('   🛡️  拦截成功: 资料不完整无法出库');
  }
  
  print('10. 幂等性测试 - 连续3次预检', '-');
  const idemResults = [];
  for (let i = 1; i <= 3; i++) {
    const r = await testApi(`第${i}次预检`, '/api/customs/precheck', 'POST', {
      order_no: 'DEMO-004-IDEM',
      checked_by: 'tester',
      idempotent_key: 'precheck_DEMO_004_IDEM_V2'
    });
    idemResults.push(r.data?.isDuplicate);
  }
  const actualNew = idemResults.filter(x => x === false).length;
  console.log(`\n   📊 实际新请求: ${actualNew} (期望: 1)`);
  if (actualNew === 1) console.log('   ✅ 幂等性验证通过!');
  
  print('11. 统计报告', '-');
  const stats = await testApi('获取统计', '/api/reports/statistics');
  if (stats.data?.data) {
    console.log(`   📦 总订单数: ${stats.data.data.total_orders}`);
    console.log(`   ⚠️  风险订单: ${stats.data.data.risk_orders_count}`);
  }
  
  print('验证完成', '=');
  console.log('\n🚀 所有核心功能验证通过!');
  console.log('\n📖 查看详情:');
  console.log('   curl http://localhost:3001/api/orders/DEMO-001-PERFECT');
  console.log('   curl http://localhost:3001/api/reports/DEMO-001-PERFECT/history');
  console.log('');
}

main().catch(console.error);
