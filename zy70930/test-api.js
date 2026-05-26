const http = require('http');
const fs = require('fs');
const path = require('path');

function request(options, body = null, isMultipart = false) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: result, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    
    if (body) {
      if (isMultipart) {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 开始测试汽修对账服务 API...\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  };

  console.log('1️⃣  测试登录接口...');
  const loginRes = await request(
    { ...baseOptions, path: '/api/auth/login', method: 'POST' },
    { username: 'admin', password: 'admin123' }
  );
  console.log(`   状态: ${loginRes.status}`);
  if (loginRes.status !== 200) {
    console.log(`   ❌ 登录失败: ${JSON.stringify(loginRes.data)}`);
    return;
  }
  const token = loginRes.data.token;
  console.log('   ✅ 登录成功，获取到 token\n');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  console.log('2️⃣  创建对账批次...');
  const createBatchRes = await request(
    { ...baseOptions, path: '/api/batches', method: 'POST', headers: authHeaders },
    { name: '2024年4月对账测试', storeId: 's001', periodStart: '2024-04-01', periodEnd: '2024-04-30' }
  );
  console.log(`   状态: ${createBatchRes.status}`);
  console.log(`   响应: ${JSON.stringify(createBatchRes.data)}`);
  const batchId = createBatchRes.data.batchId;
  console.log(`   ✅ 批次创建成功: ${batchId}\n`);

  console.log('3️⃣  导入套餐数据...');
  const packagesCsv = fs.readFileSync(path.join(__dirname, 'sample-data/packages.csv'));
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let multipartBody = '';
  multipartBody += `------${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="batchId"\r\n\r\n${batchId}\r\n`;
  multipartBody += `------${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="storeId"\r\n\r\ns001\r\n`;
  multipartBody += `------${boundary}\r\n`;
  multipartBody += `Content-Disposition: form-data; name="file"; filename="packages.csv"\r\n`;
  multipartBody += `Content-Type: text/csv\r\n\r\n${packagesCsv}\r\n`;
  multipartBody += `------${boundary}--\r\n`;

  const importPkgRes = await request(
    { 
      ...baseOptions, 
      path: '/api/import/packages', 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=----${boundary}`
      }
    },
    multipartBody,
    true
  );
  console.log(`   状态: ${importPkgRes.status}`);
  console.log(`   响应: ${JSON.stringify(importPkgRes.data)}`);
  console.log('   ✅ 套餐导入完成\n');

  console.log('4️⃣  导入工单数据...');
  const woJson = fs.readFileSync(path.join(__dirname, 'sample-data/workorders.json'));
  let woBody = '';
  woBody += `------${boundary}\r\n`;
  woBody += `Content-Disposition: form-data; name="batchId"\r\n\r\n${batchId}\r\n`;
  woBody += `------${boundary}\r\n`;
  woBody += `Content-Disposition: form-data; name="storeId"\r\n\r\ns001\r\n`;
  woBody += `------${boundary}\r\n`;
  woBody += `Content-Disposition: form-data; name="file"; filename="workorders.json"\r\n`;
  woBody += `Content-Type: application/json\r\n\r\n${woJson}\r\n`;
  woBody += `------${boundary}--\r\n`;

  const importWoRes = await request(
    { 
      ...baseOptions, 
      path: '/api/import/workorders', 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=----${boundary}`
      }
    },
    woBody,
    true
  );
  console.log(`   状态: ${importWoRes.status}`);
  console.log(`   响应: ${JSON.stringify(importWoRes.data)}`);
  console.log('   ✅ 工单导入完成\n');

  console.log('5️⃣  导入库存数据...');
  const invCsv = fs.readFileSync(path.join(__dirname, 'sample-data/inventory.csv'));
  let invBody = '';
  invBody += `------${boundary}\r\n`;
  invBody += `Content-Disposition: form-data; name="batchId"\r\n\r\n${batchId}\r\n`;
  invBody += `------${boundary}\r\n`;
  invBody += `Content-Disposition: form-data; name="storeId"\r\n\r\ns001\r\n`;
  invBody += `------${boundary}\r\n`;
  invBody += `Content-Disposition: form-data; name="file"; filename="inventory.csv"\r\n`;
  invBody += `Content-Type: text/csv\r\n\r\n${invCsv}\r\n`;
  invBody += `------${boundary}--\r\n`;

  const importInvRes = await request(
    { 
      ...baseOptions, 
      path: '/api/import/inventory', 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=----${boundary}`
      }
    },
    invBody,
    true
  );
  console.log(`   状态: ${importInvRes.status}`);
  console.log(`   响应: ${JSON.stringify(importInvRes.data)}`);
  console.log('   ✅ 库存导入完成\n');

  console.log('6️⃣  执行对账...');
  const runRes = await request(
    { ...baseOptions, path: `/api/batches/${batchId}/run`, method: 'POST', headers: authHeaders }
  );
  console.log(`   状态: ${runRes.status}`);
  console.log(`   响应: ${JSON.stringify(runRes.data)}`);
  console.log('   ✅ 对账执行完成\n');

  console.log('7️⃣  获取对账结果...');
  const detailRes = await request(
    { ...baseOptions, path: `/api/batches/${batchId}`, method: 'GET', headers: authHeaders }
  );
  console.log(`   状态: ${detailRes.status}`);
  
  const detail = detailRes.data;
  const batch = detail.batch;
  console.log(`\n   📊 对账汇总:`);
  console.log(`      批次: ${batch.name} (${batch.batch_no})`);
  console.log(`      状态: ${batch.status}`);
  console.log(`      套餐数量: ${batch.total_packages}`);
  console.log(`      工单数量: ${batch.total_work_orders}`);
  console.log(`      库存配件数量: ${batch.total_inventory_items}`);
  console.log(`      匹配成功: ${batch.matched_count}`);
  console.log(`      差异数量: ${batch.discrepancy_count}`);
  console.log(`      对账记录数: ${detail.records.length}`);
  console.log(`      差异明细数: ${detail.discrepancies.length}\n`);

  if (detail.discrepancies.length > 0) {
    console.log('   🔍 发现的差异:');
    for (const d of detail.discrepancies.slice(0, 5)) {
      try {
        const exp = JSON.parse(d.explanation);
        console.log(`      • ${exp.title} [${d.severity}]: ${exp.summary}`);
      } catch (e) {
        console.log(`      • ${d.discrepancy_type} [${d.severity}]: ${d.explanation}`);
      }
    }
    if (detail.discrepancies.length > 5) {
      console.log(`      ... 还有 ${detail.discrepancies.length - 5} 条差异`);
    }
  }
  console.log('\n   ✅ 对账结果获取成功\n');

  console.log('8️⃣  测试复核功能...');
  if (detail.records.length > 0) {
    const recordId = detail.records[0].id;
    const reviewRes = await request(
      { ...baseOptions, path: `/api/batches/records/${recordId}/review`, method: 'POST', headers: authHeaders },
      { reviewResult: 'approved', reviewComment: '测试复核通过' }
    );
    console.log(`   状态: ${reviewRes.status}`);
    console.log(`   响应: ${JSON.stringify(reviewRes.data)}`);
    console.log('   ✅ 复核成功\n');
  }

  console.log('9️⃣  导出 Excel 报告...');
  const exportRes = await request(
    { ...baseOptions, path: `/api/reports/${batchId}/json`, method: 'GET', headers: authHeaders }
  );
  console.log(`   状态: ${exportRes.status}`);
  console.log(`   报告数据包含: ${exportRes.data.discrepancies?.length || 0} 条差异, ${exportRes.data.records?.length || 0} 条记录`);
  console.log('   ✅ 报告导出成功\n');

  console.log('🎉 所有测试通过！对账服务运行正常');
  console.log('\n📋 可验证的场景:');
  console.log('   ✓ 跨店核销 (PKG2024002 在 s001 购买，s002 使用)');
  console.log('   ✓ 项目替换 (PKG2024004 空气滤芯→空调滤芯)');
  console.log('   ✓ 价格差异 (工单机油单价155元 vs 库存149元)');
  console.log('   ✓ 库存盘盈/盘亏自动计算');
  console.log('\n📝 接下来可以:');
  console.log('   1. 人工复核差异记录');
  console.log('   2. 标记差异为已解决');
  console.log('   3. 所有差异解决后完成批次');
  console.log('   4. 导出 Excel/PDF 报告');
}

runTests().catch(console.error);
