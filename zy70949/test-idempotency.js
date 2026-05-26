const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'localhost';
const PORT = process.env.PORT || 3000;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function formDataRequest(options, fields, files) {
  return new Promise((resolve, reject) => {
    const boundary = '----TestBoundary' + Date.now();
    let body = '';

    for (const [key, value] of Object.entries(fields)) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      body += `${value}\r\n`;
    }

    for (const [fieldname, filepath] of Object.entries(files)) {
      const filename = path.basename(filepath);
      const content = fs.readFileSync(filepath);
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\n`;
      body += `Content-Type: application/octet-stream\r\n\r\n`;
      body = Buffer.concat([Buffer.from(body), content, Buffer.from(`\r\n`)]);
    }

    body = Buffer.concat([Buffer.from(body), Buffer.from(`--${boundary}--\r\n`)]);

    const req = http.request({
      ...options,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testIdempotency() {
  console.log('=== 幂等性测试：同一批文件重复提交 ===\n');

  const testData = {
    addItems: [
      {
        id: 'IDEMPOTENCY_TEST_001',
        customerName: '幂等测试用户',
        idCard: '110101199999999999',
        phone: '13900000000',
        packageCode: 'PKG_A',
        itemCode: 'ITEM_C1',
        itemName: '心脏彩超',
        itemPrice: 380,
        quantity: 1,
        couponCode: 'COUPON_10',
        couponAmount: 10,
        unitCode: 'UNIT_A',
        operator: '测试医生',
        operationTime: '2026-05-20T09:30:00'
      }
    ],
    packages: [
      {
        packageCode: 'PKG_A',
        packageName: '标准体检套餐',
        basePrice: 1580,
        includedItems: ['ITEM_B1', 'ITEM_B2'],
        addableItems: ['ITEM_C1', 'ITEM_C2', 'ITEM_C3']
      }
    ],
    unitAgreements: [
      {
        unitCode: 'UNIT_A',
        unitName: '测试单位',
        contractNumber: 'TEST-001',
        totalQuota: 200000,
        usedQuota: 100000,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        eligibleEmployees: ['110101199999999999'],
        allowedPackages: ['PKG_A'],
        settlementType: 'monthly'
      }
    ],
    coupons: [
      {
        couponCode: 'COUPON_10',
        couponType: 'cash',
        value: 10,
        maxStackCount: 10,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        applicableItems: []
      }
    ]
  };

  const postData = JSON.stringify(testData);

  console.log('第 1 次提交：');
  const result1 = await makeRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/process',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, postData);

  console.log('  状态:', result1.status);
  console.log('  批次ID:', result1.data.data.batchId);
  console.log('  正常记录数:', result1.data.data.summary.normalCount);
  console.log('  警告:', result1.data.data.warnings);
  console.log();

  console.log('第 2 次提交（JSON 模式，纯数据模式不幂等，应有新的随机 batchId）：');
  const result2 = await makeRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/process',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, postData);

  console.log('  状态:', result2.status);
  console.log('  批次ID:', result2.data.data.batchId);
  console.log('  批次ID与第一次不同:', result1.data.data.batchId !== result2.data.data.batchId);
  console.log('  警告:', result2.data.data.warnings);
  console.log();

  console.log('第 1 次文件上传（文件模式，应被记录）：');
  const fileResult1 = await formDataRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/upload',
    method: 'POST',
  }, {}, {
    addItems: 'test-data/add-items.csv',
    packages: 'test-data/packages.json',
    unitAgreements: 'test-data/unit-agreements.json',
    coupons: 'test-data/coupons.json'
  });

  console.log('  状态:', fileResult1.status);
  console.log('  批次ID:', fileResult1.data.data.batchId);
  console.log('  总记录数:', fileResult1.data.data.totalCount);
  console.log('  警告:', fileResult1.data.data.warnings);
  const firstBatchId = fileResult1.data.data.batchId;
  console.log();

  console.log('第 2 次文件上传（相同文件，应命中幂等检查，被拒绝）：');
  const fileResult2 = await formDataRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/upload',
    method: 'POST',
  }, {}, {
    addItems: 'test-data/add-items.csv',
    packages: 'test-data/packages.json',
    unitAgreements: 'test-data/unit-agreements.json',
    coupons: 'test-data/coupons.json'
  });

  console.log('  状态:', fileResult2.status);
  console.log('  批次ID:', fileResult2.data.data.batchId);
  console.log('  批次ID与第一次相同:', fileResult2.data.data.batchId === firstBatchId);
  console.log('  总记录数（应为0）:', fileResult2.data.data.totalCount);
  console.log('  正常记录数（应为0）:', fileResult2.data.data.summary.normalCount);
  console.log('  警告（应有重复提交警告）:', fileResult2.data.data.warnings);
  console.log();

  const hasIdempotencyWarning = fileResult2.data.data.warnings.some(w => w.includes('重复提交'));
  console.log('幂等性验证结果:', hasIdempotencyWarning ? '✅ 通过 - 第二次提交被正确拒绝' : '❌ 失败 - 第二次提交未被检测到');
  console.log('批次ID一致性:', fileResult2.data.data.batchId === firstBatchId ? '✅ 通过 - 相同文件产生相同 batchId' : '❌ 失败 - batchId 不一致');
}

async function main() {
  console.log('体检中心财务对账 API - 幂等性专项测试');
  console.log('目标地址:', `http://${BASE_URL}:${PORT}`);
  console.log();
  
  try {
    await testIdempotency();
    console.log('\n=== 幂等性测试完成 ===');
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('请确保服务已启动: npm run dev');
  }
}

main();
