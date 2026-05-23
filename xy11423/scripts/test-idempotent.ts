import http from 'http';

function request(options: http.RequestOptions, data?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function createBatchData(batchNo: string, strategy: string) {
  return {
    batchNo,
    vin: 'IDEMPOTENT-TEST-VIN',
    plateNumber: '京A99999',
    responsiblePerson: '幂等测试员',
    strategy,
    inspectionSheets: [{
      sheetNo: `INSP-${batchNo}-001`,
      inspector: '李检测',
      inspectionDate: Date.now(),
      mileage: 58000,
      overallStatus: 'good',
      items: JSON.stringify([{ name: '发动机', status: '正常' }]),
      remarks: '状态良好'
    }],
    repairQuotes: [],
    photoItems: [{
      photoNo: `PHOTO-${batchNo}-001`,
      category: '外观',
      name: '左前方',
      url: 'http://example.com/1.jpg',
      uploadedBy: '陈拍摄',
      uploadedAt: Date.now(),
      isAbnormal: false
    }],
    smsScreenshots: [],
    operator: 'idempotent-test',
    operatorRole: 'tester'
  };
}

async function testIgnoreStrategy() {
  console.log('\n🧪 测试1: IGNORE策略 - 重复提交应该忽略');
  const batchNo = 'IDEMPOTENT-IGNORE-' + Date.now();
  
  const result1 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, createBatchData(batchNo, 'ignore'));
  
  console.log(`   第一次提交: 状态=${result1.data?.status}, isRetry=${result1.data?.isRetry}`);
  
  const result2 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, createBatchData(batchNo, 'ignore'));
  
  console.log(`   第二次提交: 状态=${result2.data?.status}, isRetry=${result2.data?.isRetry}, 策略=${result2.data?.strategyApplied}`);
  console.log(`   提交次数: ${result2.data?.totalItems}项`);
  
  if (result2.data?.strategyApplied === 'ignore' && result2.data?.totalItems === 0) {
    console.log('   ✅ IGNORE策略验证通过');
  } else {
    console.log('   ❌ IGNORE策略验证失败');
  }
  
  return result1.data?.batchId;
}

async function testOverwriteStrategy() {
  console.log('\n🧪 测试2: OVERWRITE策略 - 重复提交应该覆盖');
  const batchNo = 'IDEMPOTENT-OVERWRITE-' + Date.now();
  
  const data1 = createBatchData(batchNo, 'overwrite');
  data1.inspectionSheets[0].remarks = '第一次提交';
  
  const result1 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, data1);
  
  console.log(`   第一次提交: 状态=${result1.data?.status}, 成功项=${result1.data?.successItems}`);
  
  const data2 = createBatchData(batchNo, 'overwrite');
  data2.inspectionSheets[0].remarks = '第二次提交';
  data2.inspectionSheets.push({
    sheetNo: `INSP-${batchNo}-002`,
    inspector: '新增检测员',
    inspectionDate: Date.now(),
    mileage: 60000,
    overallStatus: 'normal',
    items: JSON.stringify([{ name: '变速箱', status: '正常' }]),
    remarks: '新增的检测单'
  });
  
  const result2 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, data2);
  
  console.log(`   第二次提交: 状态=${result2.data?.status}, 成功项=${result2.data?.successItems}, 策略=${result2.data?.strategyApplied}`);
  
  if (result2.data?.strategyApplied === 'overwrite' && result2.data?.successItems === 3) {
    console.log('   ✅ OVERWRITE策略验证通过');
  } else {
    console.log('   ❌ OVERWRITE策略验证失败');
  }
}

async function testAppendStrategy() {
  console.log('\n🧪 测试3: APPEND策略 - 重复提交应该追加');
  const batchNo = 'IDEMPOTENT-APPEND-' + Date.now();
  
  const data1 = createBatchData(batchNo, 'append');
  data1.inspectionSheets[0].sheetNo = `INSP-APPEND-001`;
  
  const result1 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, data1);
  
  console.log(`   第一次提交: 成功项=${result1.data?.successItems}, isRetry=${result1.data?.isRetry}`);
  
  const data2 = createBatchData(batchNo, 'append');
  data2.inspectionSheets = [{
    sheetNo: `INSP-APPEND-002`,
    inspector: '追加检测员',
    inspectionDate: Date.now(),
    mileage: 58000,
    overallStatus: 'good',
    items: JSON.stringify([{ name: '刹车', status: '正常' }]),
    remarks: '追加的检测单'
  }];
  data2.photoItems = [];
  
  const result2 = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, data2);
  
  console.log(`   第二次提交: 成功项=${result2.data?.successItems}, 策略=${result2.data?.strategyApplied}`);
  
  const batchId = result2.data?.batchId;
  const detail = await request({
    hostname: 'localhost', port: 3000, path: `/api/batches/${batchId}`,
    method: 'GET'
  });
  
  const inspectionCount = detail.data?.inspectionSheets?.length;
  const photoCount = detail.data?.photoItems?.length;
  console.log(`   查询结果: 检测单=${inspectionCount}张, 照片=${photoCount}张`);
  
  if (inspectionCount >= 2 && photoCount >= 1) {
    console.log('   ✅ APPEND策略验证通过');
  } else {
    console.log('   ❌ APPEND策略验证失败');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('二手车整备验收回放链路服务 - 幂等性测试');
  console.log('='.repeat(60));

  try {
    await testIgnoreStrategy();
    await testOverwriteStrategy();
    await testAppendStrategy();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有幂等性测试完成!');
    console.log('='.repeat(60));
  } catch (e: any) {
    console.error('\n❌ 测试失败:', e.message);
    process.exit(1);
  }
}

main();
