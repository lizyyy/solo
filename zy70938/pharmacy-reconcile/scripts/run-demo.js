'use strict';

const http = require('http');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const body = options.body || null;
    const headers = { 'Content-Type': 'application/json' };
    if (body) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ hostname: 'localhost', port: 3000, path, method, headers }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('=== 药店对账服务演示 ===\n');

  // 1. 导入样例购药数据并对账
  console.log('1. 导入样例购药数据并自动对账...');
  const importRes = await request('/api/reconcile/import', { method: 'POST', body: JSON.stringify({ today: '2026-05-27' }) });
  const { sessionId, summary } = importRes.data;
  console.log('   会话ID:', sessionId);
  console.log('   自动对账汇总:', JSON.stringify(summary, null, 2).replace(/\n/g, '\n   '));

  // 2. 查看需人工复核的记录
  console.log('\n2. 查看需人工复核的记录...');
  const reviewRes = await request(`/api/reconcile/session/${sessionId}/records?action=REVIEW_REQUIRED`);
  for (const rec of reviewRes.data.records) {
    console.log(`   记录 ${rec.id}: ${rec.purchase.medicine} (${rec.purchase.customerName})`);
    for (const d of rec.discrepancies) {
      console.log(`     - [${d.type}] ${d.message}`);
    }
  }

  // 3. 人工复核：放行第一条（假设医生已同意使用）
  if (reviewRes.data.records.length > 0) {
    const first = reviewRes.data.records[0];
    console.log(`\n3. 人工复核记录 ${first.id}: 放行（APPROVE）`);
    const reviewResult = await request(`/api/reconcile/session/${sessionId}/review/${first.id}`, {
      method: 'POST',
      body: JSON.stringify({ action: 'APPROVE', note: '顾客近期在三甲医院做过皮试，医生同意使用青霉素类药物' })
    });
    console.log('   复核后汇总:', JSON.stringify(reviewResult.data.summary, null, 2).replace(/\n/g, '\n   '));
  }

  // 4. 重新计算（模拟新一天）
  console.log('\n4. 触发重新计算（保留人工复核结论）...');
  const recalcRes = await request(`/api/reconcile/session/${sessionId}/recalc`, {
    method: 'POST',
    body: JSON.stringify({ today: '2026-05-28' })
  });
  console.log('   重算后汇总:', JSON.stringify(recalcRes.data.summary, null, 2).replace(/\n/g, '\n   '));

  // 5. 导出 JSON 报告
  console.log('\n5. 导出 JSON 报告...');
  const reportRes = await request(`/api/reconcile/session/${sessionId}/report`);
  console.log(`   报告生成：共 ${reportRes.data.records.length} 条记录`);
  const firstRec = reportRes.data.records.find((r) => r.reviewed);
  if (firstRec) {
    console.log(`   已复核记录 ${firstRec.id}:`);
    console.log(`     购药: ${firstRec.purchase.medicine}`);
    console.log(`     顾客标签: ${firstRec.customer ? firstRec.customer.tags.join(',') : '无'}`);
    console.log(`     复核结论: ${firstRec.finalAction}`);
    console.log(`     复核说明: ${firstRec.reviewerNote}`);
    console.log(`     差异原因: ${firstRec.discrepancies.map((d) => d.message).join('; ')}`);
  }

  console.log('\n=== 演示结束 ===');
  console.log(`   完整报告地址: GET http://localhost:3000/api/reconcile/session/${sessionId}/report`);
  console.log(`   CSV 报告:      GET http://localhost:3000/api/reconcile/session/${sessionId}/report?format=csv`);
}

main().catch((err) => {
  console.error('演示失败:', err.message);
  console.log('请先确保服务已启动: npm start');
  process.exit(1);
});
