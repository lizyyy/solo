const http = require('http');

const PORT = 3002;
const HOST = 'localhost';

const makeRequest = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
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
};

const runTest = async () => {
  console.log('========================================');
  console.log('处方取药幂等核销台 API 测试');
  console.log('========================================\n');

  console.log('1. 健康检查...');
  let res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/health',
    method: 'GET'
  });
  console.log('   状态码:', res.statusCode);
  console.log('   响应:', JSON.stringify(res.body, null, 2));
  console.log();

  console.log('2. 查询库存...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/prescriptions/inventory',
    method: 'GET'
  });
  console.log('   状态码:', res.statusCode);
  console.log('   库存数量:', res.body.data.length);
  console.log();

  console.log('3. 创建处方...');
  const prescriptionBody = {
    patientName: 'Zhang San',
    patientIdCard: '110101199001011234',
    items: [
      { drugCode: 'DRUG001', quantity: 2 },
      { drugCode: 'DRUG002', quantity: 1 }
    ]
  };
  
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/prescriptions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Operator': 'Dr.Zhang'
    }
  }, prescriptionBody);
  console.log('   状态码:', res.statusCode);
  console.log('   响应:', JSON.stringify(res.body, null, 2));
  const prescriptionNo = res.body.data?.prescription_no;
  console.log('   处方编号:', prescriptionNo);
  console.log();

  console.log('4. 第一次核销处方（幂等键: KEY-001）...');
  const idempotencyKey1 = 'KEY-' + Date.now();
  const fulfillBody = {
    prescriptionNo: prescriptionNo,
    pharmacistName: 'Dr. Zhang'
  };
  
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/fulfillments/fulfill',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey1,
      'X-Operator': 'Dr. Zhang'
    }
  }, fulfillBody);
  console.log('   状态码:', res.statusCode);
  console.log('   核销单号:', res.body.data?.fulfillment?.fulfillment_no);
  console.log('   处方状态:', res.body.data?.prescription?.status);
  console.log('   是否重复:', res.body.isDuplicate);
  const fulfillmentNo = res.body.data?.fulfillment?.fulfillment_no;
  console.log();

  console.log('5. 第二次使用相同幂等键核销（应该返回首次结果）...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/fulfillments/fulfill',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey1,
      'X-Operator': 'Dr. Zhang'
    }
  }, fulfillBody);
  console.log('   状态码:', res.statusCode);
  console.log('   核销单号:', res.body.data?.fulfillment?.fulfillment_no);
  console.log('   是否重复:', res.body.isDuplicate);
  console.log('   消息:', res.body.message);
  console.log();

  console.log('6. 检查核销后库存...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/prescriptions/inventory',
    method: 'GET'
  });
  const drug1 = res.body.data.find(d => d.drug_code === 'DRUG001');
  const drug2 = res.body.data.find(d => d.drug_code === 'DRUG002');
  console.log('   阿莫西林胶囊 (DRUG001):', drug1.quantity, '(初始100, 扣减2后应该98)');
  console.log('   布洛芬缓释胶囊 (DRUG002):', drug2.quantity, '(初始80, 扣减1后应该79)');
  console.log();

  console.log('7. 查询对账差异...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/audit/reconciliation',
    method: 'GET'
  });
  console.log('   状态码:', res.statusCode);
  console.log('   差异总数:', res.body.data?.stats?.total);
  console.log();

  console.log('8. 撤销核销（幂等键: KEY-CANCEL-001）...');
  const cancelIdempotencyKey = 'KEY-CANCEL-' + Date.now();
  const cancelBody = {
    fulfillmentNo: fulfillmentNo,
    reason: 'User cancelled'
  };
  
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/fulfillments/cancel',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': cancelIdempotencyKey,
      'X-Operator': 'Dr. Zhang'
    }
  }, cancelBody);
  console.log('   状态码:', res.statusCode);
  console.log('   核销单状态:', res.body.data?.fulfillment?.status);
  console.log('   处方状态:', res.body.data?.prescription?.status);
  console.log();

  console.log('9. 检查撤销后库存...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/prescriptions/inventory',
    method: 'GET'
  });
  const drug1After = res.body.data.find(d => d.drug_code === 'DRUG001');
  const drug2After = res.body.data.find(d => d.drug_code === 'DRUG002');
  console.log('   阿莫西林胶囊 (DRUG001):', drug1After.quantity, '(撤销后应该恢复100)');
  console.log('   布洛芬缓释胶囊 (DRUG002):', drug2After.quantity, '(撤销后应该恢复80)');
  console.log();

  console.log('10. 导出审计报告 (JSON)...');
  res = await makeRequest({
    hostname: HOST,
    port: PORT,
    path: '/api/audit/report/preview',
    method: 'GET'
  });
  console.log('   状态码:', res.statusCode);
  console.log('   审计日志总数:', res.body.data?.summary?.totalAuditLogs);
  console.log('   处方总数:', res.body.data?.summary?.totalPrescriptions);
  console.log();

  console.log('========================================');
  console.log('测试完成！');
  console.log('========================================');
};

runTest().catch(console.error);
