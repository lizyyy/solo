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

async function testHealth() {
  console.log('\n=== 测试健康检查 ===');
  const result = await makeRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/health',
    method: 'GET'
  });
  console.log('状态:', result.status);
  console.log('数据:', JSON.stringify(result.data, null, 2));
  return result;
}

async function testRules() {
  console.log('\n=== 测试规则列表 ===');
  const result = await makeRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/rules',
    method: 'GET'
  });
  console.log('状态:', result.status);
  console.log('规则分类:');
  result.data.rules.forEach(category => {
    console.log(`  ${category.category}:`);
    category.rules.forEach(r => {
      console.log(`    - ${r.code} (${r.severity}): ${r.name}`);
    });
  });
  return result;
}

async function testProcessJSON() {
  console.log('\n=== 测试 JSON 数据处理 ===');

  const addItems = [
    {
      id: 'TEST001', customerName: '测试用户A', idCard: '110101199001011234',
      phone: '13800138001', packageCode: 'PKG_A', itemCode: 'ITEM_C1',
      itemName: '心脏彩超', itemPrice: 380, quantity: 1,
      couponCode: 'COUPON_10', couponAmount: 10, unitCode: 'UNIT_A',
      operator: '测试医生', operationTime: '2026-05-20T09:30:00'
    },
    {
      id: 'TEST002', customerName: '测试用户B', idCard: '110101199002022345',
      phone: '13800138002', packageCode: 'PKG_B', itemCode: 'ITEM_B1',
      itemName: '内科检查', itemPrice: 50, quantity: 1,
      operator: '测试医生', operationTime: '2026-05-20T10:00:00'
    },
    {
      id: 'TEST003', customerName: '测试用户C', idCard: '110101199003033456',
      phone: '13800138003', packageCode: 'PKG_A', itemCode: 'ITEM_C7',
      itemName: '腰椎MRI', itemPrice: 880, quantity: 1,
      couponCode: 'COUPON_STACK', couponAmount: 50, unitCode: 'UNIT_B',
      operator: '测试医生', operationTime: '2026-05-20T11:00:00'
    },
    {
      id: 'TEST004', customerName: '测试用户C', idCard: '110101199003033456',
      phone: '13800138003', packageCode: 'PKG_A', itemCode: 'ITEM_C7',
      itemName: '腰椎MRI', itemPrice: 880, quantity: 1,
      couponCode: 'COUPON_STACK', couponAmount: 50, unitCode: 'UNIT_B',
      operator: '测试医生', operationTime: '2026-05-20T11:30:00'
    },
    {
      id: 'TEST005', customerName: '测试用户C', idCard: '110101199003033456',
      phone: '13800138003', packageCode: 'PKG_A', itemCode: 'ITEM_C7',
      itemName: '腰椎MRI', itemPrice: 880, quantity: 1,
      couponCode: 'COUPON_STACK', couponAmount: 50, unitCode: 'UNIT_B',
      operator: '测试医生', operationTime: '2026-05-20T12:00:00'
    },
    {
      id: 'TEST006', customerName: '测试用户D', idCard: '110101199004044567',
      phone: '13800138004', packageCode: 'PKG_A', itemCode: 'ITEM_C1',
      itemName: '心脏彩超', itemPrice: 380, quantity: 1,
      operator: '测试医生', operationTime: '2026-05-20T13:00:00',
      isRefund: true, originalRecordId: 'NONEXIST'
    }
  ];

  const packages = [
    {
      packageCode: 'PKG_A', packageName: '标准体检套餐', basePrice: 1580,
      includedItems: ['ITEM_B1', 'ITEM_B2', 'ITEM_B3'],
      addableItems: ['ITEM_C1', 'ITEM_C2', 'ITEM_C3', 'ITEM_C4', 'ITEM_C7']
    },
    {
      packageCode: 'PKG_B', packageName: '基础体检套餐', basePrice: 680,
      includedItems: ['ITEM_B1', 'ITEM_B2'],
      addableItems: ['ITEM_C1', 'ITEM_C2', 'ITEM_C3']
    }
  ];

  const unitAgreements = [
    {
      unitCode: 'UNIT_A', unitName: '测试单位A', contractNumber: 'TEST-001',
      totalQuota: 200000, usedQuota: 199500,
      validFrom: '2026-01-01', validTo: '2026-12-31',
      eligibleEmployees: ['110101199001011234'],
      allowedPackages: ['PKG_A', 'PKG_B'],
      settlementType: 'monthly'
    },
    {
      unitCode: 'UNIT_B', unitName: '测试单位B', contractNumber: 'TEST-002',
      totalQuota: 500000, usedQuota: 150000,
      validFrom: '2026-01-01', validTo: '2026-12-31',
      eligibleEmployees: ['110101199003033456'],
      allowedPackages: ['PKG_A', 'PKG_B', 'PKG_C'],
      settlementType: 'quarterly'
    }
  ];

  const coupons = [
    {
      couponCode: 'COUPON_10', couponType: 'cash', value: 10, maxStackCount: 10,
      validFrom: '2026-01-01', validTo: '2026-12-31', applicableItems: []
    },
    {
      couponCode: 'COUPON_STACK', couponType: 'cash', value: 50, maxStackCount: 2,
      validFrom: '2026-01-01', validTo: '2026-12-31', applicableItems: [],
      minConsumption: 500
    }
  ];

  const postData = JSON.stringify({
    addItems,
    packages,
    unitAgreements,
    coupons
  });

  const result = await makeRequest({
    hostname: BASE_URL,
    port: PORT,
    path: '/api/reconciliation/process',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, postData);

  console.log('状态:', result.status);
  if (result.data.success) {
    const response = result.data.data;
    console.log('\n--- 处理结果摘要 ---');
    console.log(`批次ID: ${response.batchId}`);
    console.log(`总记录数: ${response.totalCount}`);
    console.log(`正常: ${response.summary.normalCount}, 待确认: ${response.summary.pendingCount}, 失败: ${response.summary.failedCount}`);
    console.log(`总金额: ¥${response.summary.totalAmount.toFixed(2)}`);
    console.log(`优惠券抵扣: ¥${response.summary.couponDiscount.toFixed(2)}`);
    console.log(`单位结算金额: ¥${response.summary.unitSettlementAmount.toFixed(2)}`);

    if (response.warnings.length > 0) {
      console.log('\n--- 警告 ---');
      response.warnings.forEach(w => console.log(`  ${w}`));
    }

    if (response.ruleViolations.length > 0) {
      console.log('\n--- 规则违规统计 ---');
      response.ruleViolations.forEach(v => {
        console.log(`  [${v.severity.toUpperCase()}] ${v.ruleName}: ${v.description} (影响 ${v.affectedRecords} 条)`);
      });
    }

    if (response.normalItems.length > 0) {
      console.log('\n--- 正常放行记录 ---');
      response.normalItems.forEach(item => {
        console.log(`  ${item.record.id} [${item.record.customerName}] ${item.record.itemName} ¥${item.record.itemPrice}`);
        console.log(`    说明: ${item.readableExplanation}`);
        console.log(`    应用规则: ${item.appliedRules.join(', ')}`);
      });
    }

    if (response.pendingItems.length > 0) {
      console.log('\n--- 待确认记录 ---');
      response.pendingItems.forEach(item => {
        console.log(`  ${item.record.id} [${item.record.customerName}] ${item.record.itemName} ¥${item.record.itemPrice}`);
        console.log(`    说明: ${item.readableExplanation}`);
        console.log(`    建议: ${item.suggestions.join('; ')}`);
      });
    }

    if (response.failedItems.length > 0) {
      console.log('\n--- 失败退回记录 ---');
      response.failedItems.forEach(item => {
        console.log(`  ${item.record.id} [${item.record.customerName}] ${item.record.itemName} ¥${item.record.itemPrice}`);
        console.log(`    说明: ${item.readableExplanation}`);
        console.log(`    建议: ${item.suggestions.join('; ')}`);
      });
    }
  } else {
    console.log('错误:', result.data.error);
  }
  return result;
}

async function main() {
  console.log('体检中心财务对账 API - 本地测试');
  console.log('目标地址:', `http://${BASE_URL}:${PORT}`);
  
  try {
    await testHealth();
    await testRules();
    await testProcessJSON();
    console.log('\n=== 所有测试完成 ===');
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('请确保服务已启动: npm run dev');
  }
}

main();
