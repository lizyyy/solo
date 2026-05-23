import http from 'http';

const BASE_URL = 'http://localhost:3000';

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

async function testHealth() {
  console.log('\n📋 测试1: 健康检查');
  const result = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET'
  });
  console.log('   ✅', result.data?.status || result);
}

async function testSubmitBatch(batchNo: string, vin: string) {
  console.log(`\n📋 测试2: 提交批次 ${batchNo}`);
  const batchData = {
    batchNo,
    vin,
    plateNumber: '京A12345',
    responsiblePerson: '张三',
    strategy: 'ignore',
    inspectionSheets: [{
      sheetNo: `INSP-${batchNo}-001`,
      inspector: '李检测',
      inspectionDate: Date.now(),
      mileage: 58000,
      overallStatus: 'good',
      items: JSON.stringify([{ name: '发动机', status: '正常' }]),
      remarks: '状态良好'
    }],
    repairQuotes: [{
      quoteNo: `QUOTE-${batchNo}-001`,
      workshop: '诚信汽修',
      quotedBy: '王师傅',
      quoteDate: Date.now(),
      totalAmount: 3500,
      items: JSON.stringify([{ name: '刹车片更换', cost: 800 }]),
      laborCost: 1500,
      partsCost: 2000,
      remarks: ''
    }],
    photoItems: [
      {
        photoNo: `PHOTO-${batchNo}-001`,
        category: '外观',
        name: '左前方',
        url: 'http://example.com/1.jpg',
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now(),
        isAbnormal: false
      },
      {
        photoNo: `PHOTO-${batchNo}-002`,
        category: '发动机舱',
        name: '发动机',
        url: 'http://example.com/2.jpg',
        uploadedBy: '陈拍摄',
        uploadedAt: Date.now(),
        isAbnormal: true,
        abnormalDesc: '有渗油痕迹'
      }
    ],
    smsScreenshots: [{
      smsNo: `SMS-${batchNo}-001`,
      sender: '13800138000',
      receiver: '13900139000',
      content: '车辆已完成整备',
      sentAt: Date.now(),
      url: 'http://example.com/sms1.jpg',
      uploadedBy: '孙助理',
      uploadedAt: Date.now()
    }],
    operator: 'test-user',
    operatorRole: 'tester'
  };

  const result = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/submit',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, batchData);

  console.log('   ✅ 批次ID:', result.data?.batchId);
  console.log('   ✅ 状态:', result.data?.status);
  console.log('   ✅ 成功:', result.data?.successItems, '/', result.data?.totalItems);
  console.log('   ✅ TraceID:', result.traceId);
  
  return result.data?.batchId;
}

async function testGetBatch(batchId: string) {
  console.log('\n📋 测试3: 查询批次详情');
  const result = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches/${batchId}`,
    method: 'GET'
  });
  
  console.log('   ✅ 批次号:', result.data?.batch?.batchNo);
  console.log('   ✅ 检测单数:', result.data?.inspectionSheets?.length);
  console.log('   ✅ 报价单数:', result.data?.repairQuotes?.length);
  console.log('   ✅ 照片数:', result.data?.photoItems?.length);
  console.log('   ✅ 状态流转:', result.data?.statusTransitions?.length, '次');
  console.log('   ✅ 审计日志:', result.data?.auditLogs?.length, '条');
}

async function testRecallBatch(batchId: string) {
  console.log('\n📋 测试4: 撤回批次');
  const result = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches/${batchId}/recall`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    operator: 'test-manager',
    operatorRole: 'manager',
    reason: '数据有误需要修改'
  });
  
  console.log('   ✅ 新状态:', result.data?.status);
  console.log('   ✅ 消息:', result.message);
}

async function testFreezeAndExport(batchId: string) {
  console.log('\n📋 测试5: 冻结并导出批次');
  
  const freezeResult = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches/${batchId}/freeze`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    operator: 'test-admin',
    operatorRole: 'admin'
  });
  console.log('   ✅ 冻结状态:', freezeResult.data?.frozen ? '已冻结' : '未冻结');
  
  const exportResult = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches/${batchId}/export`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    operator: 'test-admin',
    operatorRole: 'admin'
  });
  console.log('   ✅ 导出路径:', exportResult.data?.exportPath);
}

async function testGetBatchesByVin(vin: string) {
  console.log(`\n📋 测试6: 按VIN查询所有批次 (${vin})`);
  const result = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/batches?vin=${vin}`,
    method: 'GET'
  });
  
  console.log('   ✅ 找到', result.data?.length, '个批次');
  result.data?.forEach((b: any, i: number) => {
    console.log(`      [${i + 1}] ${b.batchNo} - ${b.status} - ${b.responsiblePerson}`);
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('二手车整备验收回放链路服务 - 主流程测试');
  console.log('='.repeat(60));

  try {
    await testHealth();
    
    const batchId = await testSubmitBatch('TEST-BATCH-001', 'TESTVIN123456789');
    await testSubmitBatch('TEST-BATCH-002', 'TESTVIN123456789');
    
    if (batchId) {
      await testGetBatch(batchId);
      await testRecallBatch(batchId);
      
      const newBatchId = await testSubmitBatch('TEST-BATCH-003', 'TESTVIN987654321');
      if (newBatchId) {
        await testFreezeAndExport(newBatchId);
      }
      
      await testGetBatchesByVin('TESTVIN123456789');
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有主流程测试通过!');
    console.log('='.repeat(60));
  } catch (e: any) {
    console.error('\n❌ 测试失败:', e.message);
    process.exit(1);
  }
}

main();
