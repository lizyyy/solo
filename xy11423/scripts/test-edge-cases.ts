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

async function testPartialFailure() {
  console.log('\n⚠️  测试1: 部分失败场景');
  console.log('   提交包含错误数据的批次，验证部分成功状态');
  
  const batchNo = 'PARTIAL-FAIL-' + Date.now();
  const batchData = {
    batchNo,
    vin: 'PARTIAL-TEST-VIN',
    plateNumber: '京A88888',
    responsiblePerson: '测试员',
    strategy: 'ignore',
    inspectionSheets: [
      {
        sheetNo: 'VALID-SHEET-001',
        inspector: '李检测',
        inspectionDate: Date.now(),
        mileage: 58000,
        overallStatus: 'good',
        items: '[]',
        remarks: '正常数据'
      },
      {
        sheetNo: '',
        inspector: '',
        inspectionDate: 0,
        mileage: 0,
        overallStatus: '',
        items: '[]',
        remarks: '缺失必填字段'
      }
    ],
    repairQuotes: [{
      quoteNo: 'QUOTE-001',
      workshop: '测试汽修',
      quotedBy: '王师傅',
      quoteDate: Date.now(),
      totalAmount: 1000,
      items: '[]',
      laborCost: 500,
      partsCost: 500
    }],
    photoItems: [],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  };

  const result = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, batchData);

  console.log(`   状态: ${result.data?.status}`);
  console.log(`   成功: ${result.data?.successItems}/${result.data?.totalItems}`);
  console.log(`   错误数: ${result.data?.errors?.length}`);
  
  if (result.data?.errors?.length > 0) {
    console.log(`   错误详情:`);
    result.data.errors.forEach((e: any) => {
      console.log(`     - [${e.type}] ${e.field}: ${e.message}`);
    });
  }

  if (result.data?.status === 'partial_success') {
    console.log('   ✅ 部分失败场景验证通过');
  } else {
    console.log('   ❌ 部分失败场景验证失败');
  }
}

async function testFrozenBatchModification() {
  console.log('\n⚠️  测试2: 冻结后无法修改');
  const batchNo = 'FROZEN-TEST-' + Date.now();
  
  const submitResult = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    batchNo,
    vin: 'FROZEN-TEST-VIN',
    plateNumber: '京A77777',
    responsiblePerson: '测试员',
    strategy: 'overwrite',
    inspectionSheets: [{
      sheetNo: 'FROZEN-INSP-001',
      inspector: '李检测',
      inspectionDate: Date.now(),
      mileage: 50000,
      overallStatus: 'good',
      items: '[]'
    }],
    repairQuotes: [],
    photoItems: [],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  });

  const batchId = submitResult.data?.batchId;
  console.log(`   创建批次: ${batchNo}, ID: ${batchId?.substring(0, 8)}...`);

  await request({
    hostname: 'localhost', port: 3000, path: `/api/batches/${batchId}/freeze`,
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { operator: 'admin', operatorRole: 'admin' });
  console.log(`   冻结批次...`);

  const retryResult = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    batchNo,
    vin: 'FROZEN-TEST-VIN',
    plateNumber: '京A77777',
    responsiblePerson: '测试员',
    strategy: 'overwrite',
    inspectionSheets: [{
      sheetNo: 'NEW-INSP-001',
      inspector: '新检测员',
      inspectionDate: Date.now(),
      mileage: 60000,
      overallStatus: 'good',
      items: '[]'
    }],
    repairQuotes: [],
    photoItems: [],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  });

  console.log(`   重新提交结果: ${retryResult.error || retryResult.message}`);
  
  if (retryResult.error?.includes('已冻结')) {
    console.log('   ✅ 冻结后无法修改验证通过');
  } else {
    console.log('   ❌ 冻结后无法修改验证失败');
  }
}

async function testRecallAndResubmit() {
  console.log('\n⚠️  测试3: 撤回后再提交');
  const batchNo = 'RECALL-TEST-' + Date.now();
  
  const submitResult = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    batchNo,
    vin: 'RECALL-TEST-VIN',
    plateNumber: '京A66666',
    responsiblePerson: '测试员',
    strategy: 'overwrite',
    inspectionSheets: [{
      sheetNo: 'RECALL-INSP-001',
      inspector: '李检测',
      inspectionDate: Date.now(),
      mileage: 50000,
      overallStatus: 'good',
      items: '[]'
    }],
    repairQuotes: [],
    photoItems: [],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  });

  const batchId = submitResult.data?.batchId;
  console.log(`   创建批次: 状态=${submitResult.data?.status}`);

  const recallResult = await request({
    hostname: 'localhost', port: 3000, path: `/api/batches/${batchId}/recall`,
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, { operator: 'manager', operatorRole: 'manager', reason: '数据有误' });
  console.log(`   撤回批次: 状态=${recallResult.data?.status}`);

  const resubmitResult = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    batchNo,
    vin: 'RECALL-TEST-VIN',
    plateNumber: '京A66666',
    responsiblePerson: '测试员',
    strategy: 'overwrite',
    inspectionSheets: [{
      sheetNo: 'RECALL-INSP-002',
      inspector: '新检测员',
      inspectionDate: Date.now(),
      mileage: 55000,
      overallStatus: 'good',
      items: '[]'
    }],
    repairQuotes: [],
    photoItems: [],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  });
  console.log(`   重新提交: 状态=${resubmitResult.data?.status}, isRetry=${resubmitResult.data?.isRetry}`);

  if (resubmitResult.data?.isRetry === true) {
    console.log('   ✅ 撤回后再提交验证通过');
  } else {
    console.log('   ❌ 撤回后再提交验证失败');
  }
}

async function testManualOverride() {
  console.log('\n⚠️  测试4: 人工改判异常照片');
  
  const batchNo = 'MANUAL-TEST-' + Date.now();
  const submitResult = await request({
    hostname: 'localhost', port: 3000, path: '/api/batches/submit',
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    batchNo,
    vin: 'MANUAL-TEST-VIN',
    plateNumber: '京A55555',
    responsiblePerson: '测试员',
    strategy: 'ignore',
    inspectionSheets: [],
    repairQuotes: [],
    photoItems: [{
      photoNo: 'MANUAL-PHOTO-001',
      category: '发动机舱',
      name: '发动机渗油',
      url: 'http://example.com/1.jpg',
      uploadedBy: '陈拍摄',
      uploadedAt: Date.now(),
      isAbnormal: true,
      abnormalDesc: '气门室盖垫渗油'
    }],
    smsScreenshots: [],
    operator: 'edge-test',
    operatorRole: 'tester'
  });

  const batchId = submitResult.data?.batchId;
  const detail = await request({
    hostname: 'localhost', port: 3000, path: `/api/batches/${batchId}`,
    method: 'GET'
  });

  const abnormalPhotoId = detail.data?.abnormalPhotos?.[0]?.id;
  console.log(`   异常照片ID: ${abnormalPhotoId?.substring(0, 8)}...`);

  const overrideResult = await request({
    hostname: 'localhost', port: 3000,
    path: `/api/batches/abnormal-photos/${abnormalPhotoId}/manual-override`,
    method: 'POST', headers: { 'Content-Type': 'application/json' }
  }, {
    operator: '质检主管',
    operatorRole: 'supervisor',
    reviewResult: '经核实为正常现象，无需维修'
  });

  console.log(`   人工改判结果: ${overrideResult.message || overrideResult.error}`);

  if (overrideResult.success) {
    console.log('   ✅ 人工改判验证通过');
  } else {
    console.log('   ❌ 人工改判验证失败');
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('二手车整备验收回放链路服务 - 边界情况测试');
  console.log('='.repeat(60));

  try {
    await testPartialFailure();
    await testFrozenBatchModification();
    await testRecallAndResubmit();
    await testManualOverride();

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有边界情况测试完成!');
    console.log('='.repeat(60));
  } catch (e: any) {
    console.error('\n❌ 测试失败:', e.message);
    process.exit(1);
  }
}

main();
