const http = require('http');

const BASE_URL = 'http://localhost:3000';
let testResults = [];
let passed = 0;
let failed = 0;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
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
}

function test(name, fn) {
  testResults.push({ name, fn });
}

function assert(condition, message, actual = null, expected = null) {
  if (!condition) {
    let msg = message;
    if (actual !== null) msg += `\n    实际: ${JSON.stringify(actual)}`;
    if (expected !== null) msg += `\n    期望: ${JSON.stringify(expected)}`;
    throw new Error(msg);
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('  养老院药盒分发核验API - 自动化测试');
  console.log('========================================\n');
  
  console.log('检查服务状态...');
  try {
    const health = await request('GET', '/health');
    if (health.status !== 200 || !health.data?.success) {
      console.log('服务未启动。请先运行: npm start');
      process.exit(1);
    }
  } catch (e) {
    console.log('服务未启动。请先运行: npm start');
    process.exit(1);
  }
  console.log('服务正常 ✓\n');
  
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  test('规则说明接口可用', async () => {
    const res = await request('GET', '/api/rules');
    assert(res.status === 200, '规则接口应返回200', res.status);
    assert(res.data?.success === true, '响应应标记成功');
    assert(res.data?.data?.statusFlow, '应包含状态流转信息');
    assert(res.data?.data?.keyRules?.length >= 1, '应包含至少一条规则');
  });
  
  test('创建老人档案', async () => {
    const res = await request('POST', '/api/elders', {
      id: 'test-elder-1',
      name: '测试老人一',
      bed_number: 'T-001',
      status: 'active'
    });
    assert(res.status === 200, '创建老人应返回200', res.status);
    assert(res.data?.success === true, '创建应成功');
    assert(res.data?.data?.id === 'test-elder-1', 'ID应匹配');
  });
  
  test('创建另一个老人档案', async () => {
    const res = await request('POST', '/api/elders', {
      id: 'test-elder-2',
      name: '测试老人二',
      bed_number: 'T-002',
      status: 'active'
    });
    assert(res.status === 200, '创建老人应返回200');
    assert(res.data?.success === true, '创建应成功');
  });
  
  test('创建有效医嘱（带药品）', async () => {
    const res = await request('POST', '/api/prescriptions', {
      elder_id: 'test-elder-1',
      doctor_name: '测试医生',
      effective_from: today,
      effective_to: nextMonth,
      notes: '测试用药',
      items: [
        { medicine_name: '测试药A', dosage: '10mg', frequency: '每日1次', quantity: 1 },
        { medicine_name: '测试药B', dosage: '50mg', frequency: '每日2次', quantity: 2 }
      ]
    });
    assert(res.status === 200, '创建医嘱应返回200');
    assert(res.data?.success === true, '创建应成功');
    assert(res.data?.data?.version === 1, '版本号应为1');
    assert(res.data?.data?.items?.length === 2, '应包含2个药品');
  });
  
  test('查询不存在的老人应该失败并记录问题', async () => {
    const res = await request('GET', '/api/elders/non-existent-elder');
    assert(res.status === 404, '应返回404', res.status);
    assert(res.data?.success === false, '应标记失败');
    assert(res.data?.error?.code === 'ELDER_NOT_FOUND', '错误码应为ELDER_NOT_FOUND');
    assert(res.data?.issueRecorded === true, '应记录问题');
  });
  
  test('创建匹配的药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-1',
      box_label: '测试药盒-正确',
      intended_date: today,
      items: [
        { medicine_name: '测试药A', dosage: '10mg', quantity: 1, unit: '片' },
        { medicine_name: '测试药B', dosage: '50mg', quantity: 2, unit: '片' }
      ]
    });
    assert(res.status === 200, '创建药盒应返回200');
    assert(res.data?.success === true, '创建应成功');
    global.testGoodBoxId = res.data.data.id;
  });
  
  test('检查匹配药盒应该显示可分发', async () => {
    const res = await request('GET', `/api/pill-boxes/${global.testGoodBoxId}/match`);
    assert(res.status === 200, '匹配查询应返回200');
    assert(res.data?.success === true, '查询应成功');
    assert(res.data?.data?.matchResult?.matched === true, '应标记为匹配');
    assert(res.data?.data?.matchResult?.matchScore === 1, '匹配分数应为1');
    assert(res.data?.data?.canDistribute === true, '应允许分发');
  });
  
  test('创建剂量不匹配的药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-1',
      box_label: '测试药盒-剂量错误',
      intended_date: today,
      items: [
        { medicine_name: '测试药A', dosage: '20mg', quantity: 1, unit: '片' },
        { medicine_name: '测试药B', dosage: '50mg', quantity: 2, unit: '片' }
      ]
    });
    assert(res.status === 200, '创建药盒应返回200');
    global.testWrongDosageBoxId = res.data.data.id;
  });
  
  test('创建含额外药品的药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-1',
      box_label: '测试药盒-多药',
      intended_date: today,
      items: [
        { medicine_name: '测试药A', dosage: '10mg', quantity: 1, unit: '片' },
        { medicine_name: '测试药B', dosage: '50mg', quantity: 2, unit: '片' },
        { medicine_name: '未医嘱药', dosage: '100mg', quantity: 1, unit: '片' }
      ]
    });
    global.testExtraBoxId = res.data.data.id;
  });
  
  test('创建缺少药品的药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-1',
      box_label: '测试药盒-缺药',
      intended_date: today,
      items: [
        { medicine_name: '测试药A', dosage: '10mg', quantity: 1, unit: '片' }
      ]
    });
    global.testMissingBoxId = res.data.data.id;
  });
  
  test('创建数量不匹配的药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-1',
      box_label: '测试药盒-数量错',
      intended_date: today,
      items: [
        { medicine_name: '测试药A', dosage: '10mg', quantity: 3, unit: '片' },
        { medicine_name: '测试药B', dosage: '50mg', quantity: 2, unit: '片' }
      ]
    });
    global.testWrongQtyBoxId = res.data.data.id;
  });
  
  test('获取老人医嘱以获取医嘱ID', async () => {
    const res = await request('GET', '/api/elders/test-elder-1/prescriptions');
    assert(res.status === 200, '查询医嘱应返回200');
    assert(res.data?.success === true, '查询应成功');
    assert(res.data?.data?.length >= 1, '至少有一个医嘱');
    global.testPrescriptionId = res.data.data[0].id;
  });
  
  test('匹配的药盒分发应成功', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.testGoodBoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 200, '分发作应返回200', res.status);
    assert(res.data?.success === true, '分发作应成功', res.data?.error);
    assert(res.data?.data?.matchResult?.matched === true, '匹配结果应为true');
    global.testDistributionId = res.data.data.distribution.id;
  });
  
  test('剂量不匹配的药盒分发应失败', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.testWrongDosageBoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 400, '应返回400', res.status);
    assert(res.data?.success === false, '应标记失败');
    assert(res.data?.issueRecorded === true, '应记录问题');
  });
  
  test('含额外药品的药盒分发应失败', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.testExtraBoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 400, '应返回400');
    assert(res.data?.success === false);
    assert(res.data?.issueRecorded === true);
  });
  
  test('缺少药品的药盒分发应失败', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.testMissingBoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 400, '应返回400');
    assert(res.data?.success === false);
    assert(res.data?.issueRecorded === true);
  });
  
  test('数量不匹配的药盒分发应失败', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.testWrongQtyBoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 400, '应返回400');
    assert(res.data?.success === false);
    assert(res.data?.issueRecorded === true);
  });
  
  test('为老人二创建医嘱', async () => {
    const res = await request('POST', '/api/prescriptions', {
      elder_id: 'test-elder-2',
      doctor_name: '测试医生',
      effective_from: today,
      effective_to: nextMonth,
      notes: '测试用药2',
      items: [
        { medicine_name: '老人二专用药', dosage: '25mg', frequency: '每日1次', quantity: 1 }
      ]
    });
    global.elder2PrescriptionId = res.data.data.id;
  });
  
  test('为老人二创建匹配药盒', async () => {
    const res = await request('POST', '/api/pill-boxes', {
      elder_id: 'test-elder-2',
      box_label: '老人二药盒',
      intended_date: today,
      items: [
        { medicine_name: '老人二专用药', dosage: '25mg', quantity: 1, unit: '片' }
      ]
    });
    global.elder2BoxId = res.data.data.id;
  });
  
  test('老人二的药盒用老人一的医嘱分发应失败', async () => {
    const res = await request('POST', '/api/distributions', {
      pill_box_id: global.elder2BoxId,
      prescription_id: global.testPrescriptionId,
      distributor: '测试护士'
    });
    assert(res.status === 400, '应返回400');
    assert(res.data?.error?.code === 'PRESCRIPTION_ELDER_MISMATCH', '错误码应是PRESCRIPTION_ELDER_MISMATCH');
    assert(res.data?.issueRecorded === true, '应记录问题');
  });
  
  test('正确的回执应成功', async () => {
    const res = await request('POST', '/api/receipts', {
      distribution_id: global.testDistributionId,
      receipt_type: 'self',
      received_by: '测试老人一',
      actual_medicines: [
        { medicine_name: '测试药A', dosage: '10mg', quantity: 1 },
        { medicine_name: '测试药B', dosage: '50mg', quantity: 2 }
      ]
    });
    assert(res.status === 200, '回执应返回200', res.status);
    assert(res.data?.success === true, '回执应成功', res.data?.error);
  });
  
  test('药品不匹配的回执应失败', async () => {
    const distRes = await request('POST', '/api/distributions', {
      pill_box_id: global.elder2BoxId,
      prescription_id: global.elder2PrescriptionId,
      distributor: '测试护士'
    });
    const distId = distRes.data?.data?.distribution?.id;
    
    const res = await request('POST', '/api/receipts', {
      distribution_id: distId,
      receipt_type: 'self',
      received_by: '测试老人二',
      actual_medicines: [
        { medicine_name: '完全不同的药', dosage: '10mg', quantity: 1 }
      ]
    });
    assert(res.status === 400, '应返回400');
    assert(res.data?.error?.code === 'RECEIPT_MEDICINE_MISMATCH', '错误码应是RECEIPT_MEDICINE_MISMATCH');
    assert(res.data?.issueRecorded === true, '应记录问题');
  });
  
  test('应该能查询到问题列表（所有失败都已记录）', async () => {
    const res = await request('GET', '/api/issues?status=open');
    assert(res.status === 200, '查询问题应返回200');
    assert(res.data?.success === true, '查询应成功');
    assert(Array.isArray(res.data?.data), '应返回数组');
    assert(res.data.data.length >= 5, '至少应有5个问题（之前的失败测试）');
    
    const issueTypes = res.data.data.map(i => i.type);
    assert(issueTypes.includes('elder_not_found'), '应有elder_not_found问题');
    assert(issueTypes.includes('distribution_mismatch'), '应有distribution_mismatch问题');
    assert(issueTypes.includes('prescription_elder_mismatch'), '应有prescription_elder_mismatch问题');
    assert(issueTypes.includes('receipt_mismatch'), '应有receipt_mismatch问题');
  });
  
  test('按老人查询问题应该只返回该老人相关问题', async () => {
    const res = await request('GET', '/api/issues?elder_id=test-elder-1');
    assert(res.status === 200, '查询应返回200');
    for (const issue of res.data.data) {
      assert(
        issue.source_id === 'test-elder-1' || issue.source_type === 'prescription' || issue.source_type === 'pill_box' || issue.source_type === 'distribution',
        '问题应与老人一相关'
      );
    }
  });
  
  for (const testCase of testResults) {
    console.log(`测试: ${testCase.name}`);
    try {
      await testCase.fn();
      console.log(`  ✓ 通过\n`);
      passed++;
    } catch (err) {
      console.log(`  ✗ 失败`);
      console.log(`    原因: ${err.message}\n`);
      failed++;
    }
  }
  
  console.log('========================================');
  console.log(`  测试完成: ${passed} 通过, ${failed} 失败`);
  console.log('========================================\n');
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
