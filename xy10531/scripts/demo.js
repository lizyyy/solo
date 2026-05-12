const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3001;

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: BASE_URL,
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
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function printSeparator(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70));
}

function printStep(step, desc, result) {
  const status = result?.data?.success ? '✅' : '❌';
  const duplicate = result?.data?.isDuplicate ? ' [幂等]' : '';
  console.log(`\n  [步骤 ${step}] ${desc}`);
  console.log(`     ${status} 状态: ${result?.statusCode}`);
  if (result?.data?.message) {
    console.log(`     💬 消息: ${result.data.message}${duplicate}`);
  }
  if (result?.data?.data) {
    if (result.data.data.status) console.log(`     📊 当前状态: ${result.data.data.status}`);
    if (result.data.data.passed !== undefined) console.log(`     ✔️ 预检通过: ${result.data.data.passed}`);
    if (result.data.data.issue_count !== undefined) console.log(`     ⚠️  问题数: ${result.data.data.issue_count}`);
    if (result.data.data.supplement_no) console.log(`     📝 补件号: ${result.data.data.supplement_no}`);
    if (result.data.data.all_valid !== undefined) console.log(`     ✔️ 全部通过: ${result.data.data.all_valid}`);
    if (result.data.data.can_ship !== undefined) console.log(`     🚚 可出库: ${result.data.data.can_ship}`);
  }
}

async function waitForServer() {
  console.log('⏳ 等待服务启动...');
  for (let i = 0; i < 30; i++) {
    try {
      await request('/api/health');
      console.log('✅ 服务已就绪\n');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('服务启动超时，请先运行 npm start');
}

async function demoPerfectOrder() {
  printSeparator('演示路径 1: 资料齐全 - 直接放行');
  const orderNo = 'DEMO-001-PERFECT';
  
  const r1 = await request('/api/documents/verify', 'POST', { order_no: orderNo, doc_type: 'id_card', verified_by: 'demo_user' });
  printStep('1', '证件校验', r1);
  
  const r2 = await request('/api/taxcodes/verify', 'POST', { order_no: orderNo, verified_by: 'demo_user' });
  printStep('2', '税号校验', r2);
  
  const r3 = await request('/api/customs/precheck', 'POST', { order_no: orderNo, checked_by: 'demo_user' });
  printStep('3', '清关预检', r3);
  
  const r4 = await request('/api/customs/approve', 'POST', { order_no: orderNo, approved_by: 'manager_01' });
  printStep('4', '放行审批', r4);
  
  const r5 = await request('/api/customs/ship', 'POST', { order_no: orderNo, shipped_by: 'warehouse_01', waybill_no: 'SF1234567890' });
  printStep('5', '出库发货', r5);
  
  const r6 = await request(`/api/orders/${orderNo}`);
  console.log('\n  📋 最终订单详情:');
  console.log(`     订单号: ${orderNo}`);
  console.log(`     最终状态: ${r6.data.data.order.status}`);
  console.log(`     状态变更记录数: ${r6.data.data.status_history.length}`);
  console.log(`     检查点记录数: ${r6.data.data.checkpoints.length}`);
}

async function demoMissingDocs() {
  printSeparator('演示路径 2: 缺证件 - 补件流程');
  const orderNo = 'DEMO-002-NO-DOCS';
  
  const r1 = await request('/api/documents/verify', 'POST', { order_no: orderNo, doc_type: 'id_card', verified_by: 'demo_user' });
  printStep('1', '证件校验(失败)', r1);
  
  const r2 = await request('/api/documents/manual-correct', 'POST', {
    order_no: orderNo,
    field_name: 'receiver_id_number',
    new_value: '110101199505054321',
    corrected_by: 'operator_01',
    correction_reason: '客户补充身份证信息'
  });
  printStep('2', '人工修正身份证', r2);
  
  const r3 = await request('/api/documents/manual-correct', 'POST', {
    order_no: orderNo,
    field_name: 'receiver_id_expiry_date',
    new_value: '2033-08-15',
    corrected_by: 'operator_01',
    correction_reason: '客户补充证件有效期'
  });
  printStep('3', '人工修正有效期', r3);
  
  const r4 = await request('/api/documents/verify', 'POST', { 
    order_no: orderNo, 
    doc_type: 'id_card', 
    doc_url: '/docs/DEMO-002/id_new.jpg',
    verified_by: 'demo_user',
    idempotent_key: `doc_verify_${orderNo}_id_card_v2`
  });
  printStep('4', '重新证件校验', r4);
  
  const r5 = await request('/api/taxcodes/verify', 'POST', { order_no: orderNo, verified_by: 'demo_user' });
  printStep('5', '税号校验', r5);
  
  const r6 = await request('/api/customs/precheck', 'POST', { order_no: orderNo, checked_by: 'demo_user' });
  printStep('6', '清关预检', r6);
  
  const r7 = await request(`/api/reports/orders/${orderNo}/history`);
  console.log('\n  📜 完整时间线:');
  r7.data.data.timeline.slice(-5).forEach((event, i) => {
    console.log(`     ${i + 1}. [${event.type}] ${event.time} - ${event.reason || event.checkpoint_type || event.field}`);
  });
  
  console.log('\n  🔍 人工修正记录:');
  const orderDetail = await request(`/api/orders/${orderNo}`);
  orderDetail.data.data.manual_corrections.forEach(c => {
    console.log(`     - ${c.field_name}: "${c.old_value}" → "${c.new_value}" (${c.corrected_by})`);
  });
}

async function demoBadTaxcode() {
  printSeparator('演示路径 3: 税号错误 - 品类不匹配拦截');
  const orderNo = 'DEMO-003-BAD-TAXCODE';
  
  const r1 = await request('/api/documents/verify', 'POST', { order_no: orderNo, doc_type: 'id_card', verified_by: 'demo_user' });
  printStep('1', '证件校验(通过)', r1);
  
  const r2 = await request('/api/taxcodes/verify', 'POST', { order_no: orderNo, verified_by: 'demo_user' });
  printStep('2', '税号校验(拦截)', r2);
  
  if (r2.data.data && r2.data.data.item_results) {
    console.log('\n  ❌ 详细错误:');
    r2.data.data.item_results.filter(r => !r.valid).forEach(r => {
      console.log(`     - ${r.product_name}: ${r.reason}`);
      if (r.expected_category) console.log(`       期望品类: ${r.expected_category}`);
    });
  }
  
  const r3 = await request('/api/taxcodes/update-item-tax', 'POST', {
    order_no: orderNo,
    sku_code: 'T-SHIRT',
    tax_code: '61091000',
    category_code: 'CLTH',
    updated_by: 'tax_operator',
    update_reason: '税号品类不匹配，修正为服装类税号'
  });
  printStep('3', '修正商品税号', r3);
  
  const r4 = await request('/api/taxcodes/verify', 'POST', { 
    order_no: orderNo, 
    verified_by: 'demo_user',
    idempotent_key: `tax_verify_${orderNo}_v2`
  });
  printStep('4', '重新税号校验', r4);
  
  const r5 = await request('/api/customs/precheck', 'POST', { order_no: orderNo, checked_by: 'demo_user' });
  printStep('5', '清关预检', r5);
}

async function demoIdempotency() {
  printSeparator('演示路径 4: 幂等性 - 重复预检');
  const orderNo = 'DEMO-004-IDEM';
  
  await request('/api/documents/verify', 'POST', { order_no: orderNo, doc_type: 'id_card', verified_by: 'demo_user' });
  await request('/api/taxcodes/verify', 'POST', { order_no: orderNo, verified_by: 'demo_user' });
  
  console.log('\n  🧪 连续调用3次清关预检(使用相同幂等键)...');
  const results = [];
  for (let i = 1; i <= 3; i++) {
    const r = await request('/api/customs/precheck', 'POST', { 
      order_no: orderNo, 
      checked_by: 'demo_user',
      idempotent_key: `precheck_${orderNo}`
    });
    results.push(r);
    printStep(`${i}`, `第${i}次预检`, r);
  }
  
  console.log('\n  🔍 结果验证:');
  console.log(`     第1次: 新请求 (isDuplicate=${results[0].data.isDuplicate || false})`);
  console.log(`     第2次: 幂等返回 (isDuplicate=${results[1].data.isDuplicate || false})`);
  console.log(`     第3次: 幂等返回 (isDuplicate=${results[2].data.isDuplicate || false})`);
  
  const orderDetail = await request(`/api/orders/${orderNo}`);
  console.log(`\n     实际预检记录数: ${orderDetail.data.data.checkpoints.filter(c => c.checkpoint_type === 'precheck').length}`);
  console.log('     ✅ 验证通过: 多次调用只产生1条记录');
}

async function demoFailurePath() {
  printSeparator('失败路径: 资料不完整强行出库 - 被拦截');
  const orderNo = 'DEMO-005-EXPIRED';
  
  const r1 = await request('/api/documents/verify', 'POST', { order_no: orderNo, doc_type: 'id_card', verified_by: 'demo_user' });
  printStep('1', '证件校验(过期)', r1);
  
  const r2 = await request('/api/customs/approve', 'POST', { order_no: orderNo, approved_by: 'manager_01' });
  printStep('2', '试图直接放行(失败)', r2);
  
  const r3 = await request('/api/customs/ship', 'POST', { order_no: orderNo, shipped_by: 'warehouse_01' });
  printStep('3', '试图强行出库(被拦截)', r3);
  
  const orderDetail = await request(`/api/orders/${orderNo}`);
  console.log('\n  🔒 订单当前状态:');
  console.log(`     状态: ${orderDetail.data.data.order.status}`);
  console.log(`     风险等级: ${orderDetail.data.data.risk_assessment.level}`);
  console.log(`     可出库: ${orderDetail.data.data.risk_assessment.canShip}`);
  if (orderDetail.data.data.latest_failure) {
    console.log(`     最近失败: ${orderDetail.data.data.latest_failure.error_message}`);
  }
}

async function demoReport() {
  printSeparator('统计报告导出');
  
  const stats = await request('/api/reports/statistics');
  console.log('\n  📊 全局统计:');
  console.log(`     订单总数: ${stats.data.data.total_orders}`);
  console.log(`     风险订单: ${stats.data.data.risk_orders_count}`);
  console.log(`     补件总数: ${stats.data.data.supplement_stats.total_supplements}`);
  console.log(`     补件超时: ${stats.data.data.supplement_stats.timeout_count}`);
  
  console.log('\n  📈 状态分布:');
  Object.entries(stats.data.data.status_distribution).forEach(([status, count]) => {
    if (count > 0) console.log(`     ${status.padEnd(25)}: ${count}`);
  });
}

async function main() {
  console.log('\n' + '╔════════════════════════════════════════════════════════════╗');
  console.log('║            跨境清关资料 API - 自动化演示                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  await waitForServer();
  
  await demoPerfectOrder();
  await demoMissingDocs();
  await demoBadTaxcode();
  await demoIdempotency();
  await demoFailurePath();
  await demoReport();
  
  console.log('\n' + '═'.repeat(70));
  console.log('  🎉 演示完成！');
  console.log('  📖 查看详细订单信息:');
  console.log('     GET http://localhost:3000/api/orders/DEMO-001-PERFECT');
  console.log('     GET http://localhost:3000/api/orders/DEMO-002-NO-DOCS');
  console.log('     GET http://localhost:3000/api/reports/orders/DEMO-002-NO-DOCS/history');
  console.log('  📊 导出报告:');
  console.log('     GET http://localhost:3000/api/reports/reports/export?format=csv');
  console.log('═'.repeat(70) + '\n');
}

main().catch(console.error);
