const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
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
}

function apiRequest(method, path, body = null) {
  const url = new URL(BASE_URL + path);
  return request({
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body ? Buffer.byteLength(JSON.stringify(body)) : 0
    }
  }, body);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

function logStep(num, description) {
  console.log(`\n  [步骤 ${num}] ${description}`);
}

function logResponse(res, key = 'data') {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log('    ✓ 成功');
    if (res.body?.message) {
      console.log('    消息:', res.body.message);
    }
    if (res.body?.[key]) {
      if (res.body[key].id) {
        console.log('    ID:', res.body[key].id);
      }
      if (res.body[key].status !== undefined) {
        console.log('    状态:', res.body[key].status);
      }
      if (res.body[key].batch_code) {
        console.log('    批次号:', res.body[key].batch_code);
      }
    }
  } else {
    console.log('    ✗ 失败 (状态码:', res.statusCode, ')');
    console.log('    错误:', res.body?.error || res.body);
  }
}

async function mainFlow() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(6) + '母乳库冻存批次追踪 API - 主流程演示' + ' '.repeat(6) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  logSection('1. 健康检查');
  const health = await apiRequest('GET', '/health');
  console.log('    服务状态:', health.body?.status);
  console.log('    时间戳:', health.body?.timestamp);

  let donationId, batchId, distributionId, recallId;

  logSection('2. 捐赠登记');
  logStep(1, '登记新捐赠');
  const donationRes = await apiRequest('POST', '/api/donations', {
    donorId: 'DONOR-2026-001',
    donationDate: '2026-05-10',
    quantityMl: 400,
    notes: '捐奶妈妈身体健康，饮食规律'
  });
  logResponse(donationRes);
  donationId = donationRes.body?.data?.id;

  logStep(2, '查询捐赠详情');
  const donationDetail = await apiRequest('GET', `/api/donations/${donationId}`);
  console.log('    捐赠人:', donationDetail.body?.data?.donor_id);
  console.log('    捐赠量:', donationDetail.body?.data?.quantity_ml, 'ml');
  console.log('    当前状态:', donationDetail.body?.data?.status);

  logSection('3. 检测结果录入');
  logStep(1, '录入 HIV 检测 (阴性)');
  const hivTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'hiv',
    result: 'negative',
    testDate: '2026-05-10',
    testedBy: 'LAB-001'
  });
  logResponse(hivTest);

  logStep(2, '录入 HTLV 检测 (阴性)');
  const htlvTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'htlv',
    result: 'negative',
    testDate: '2026-05-10',
    testedBy: 'LAB-001'
  });
  logResponse(htlvTest);

  logStep(3, '录入 HBsAg 检测 (阴性)');
  const hbsagTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'hbsag',
    result: 'negative',
    testDate: '2026-05-10',
    testedBy: 'LAB-001'
  });
  logResponse(hbsagTest);

  logStep(4, '录入 梅毒 检测 (阴性)');
  const syphilisTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'syphilis',
    result: 'negative',
    testDate: '2026-05-10',
    testedBy: 'LAB-001'
  });
  logResponse(syphilisTest);

  logStep(5, '录入 细菌培养 检测 (阴性)');
  const bacterialTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'bacterial_culture',
    result: 'negative',
    testDate: '2026-05-10',
    testedBy: 'LAB-001'
  });
  logResponse(bacterialTest);

  logStep(6, '检查捐赠状态更新');
  const donationAfterTests = await apiRequest('GET', `/api/donations/${donationId}`);
  console.log('    所有检测完成后状态:', donationAfterTests.body?.data?.status);
  console.log('    备注:', donationAfterTests.body?.data?.notes);

  logSection('4. 冻存批次创建');
  logStep(1, '创建第一个冻存批次 (2袋 x 100ml)');
  const batch1 = await apiRequest('POST', '/api/batches', {
    donationId: donationId,
    containerType: 'bag_100ml',
    containerCount: 2,
    freezerLocation: 'FREEZER-A',
    freezerLevel: 'L2'
  });
  logResponse(batch1);
  batchId = batch1.body?.data?.id;

  logStep(2, '创建第二个冻存批次 (2袋 x 100ml)');
  const batch2 = await apiRequest('POST', '/api/batches', {
    donationId: donationId,
    containerType: 'bag_100ml',
    containerCount: 2,
    freezerLocation: 'FREEZER-A',
    freezerLevel: 'L2'
  });
  logResponse(batch2);

  logStep(3, '检查捐赠状态');
  const donationAfterFreeze = await apiRequest('GET', `/api/donations/${donationId}`);
  console.log('    全部冻存后状态:', donationAfterFreeze.body?.data?.status);

  logStep(4, '查看批次详情');
  const batchDetail = await apiRequest('GET', `/api/batches/${batchId}/details`);
  console.log('    批次号:', batchDetail.body?.data?.batch_code);
  console.log('    总容量:', batchDetail.body?.data?.volume_ml, 'ml');
  console.log('    可用容量:', batchDetail.body?.data?.available_volume, 'ml');
  console.log('    冰箱位置:', batchDetail.body?.data?.freezer_location);
  console.log('    有效期:', batchDetail.body?.data?.expiry_date);

  logSection('5. 发放与核验');
  logStep(1, '发放给受者 RECIPIENT-001');
  const dist1 = await apiRequest('POST', '/api/distribution/distribute', {
    batchId: batchId,
    recipientId: 'RECIPIENT-001',
    containersUsed: 1,
    verifiedBy: 'NURSE-001'
  });
  logResponse(dist1);
  distributionId = dist1.body?.data?.id;

  logStep(2, '发放给受者 RECIPIENT-002 (待核验)');
  const dist2 = await apiRequest('POST', '/api/distribution/distribute', {
    batchId: batchId,
    recipientId: 'RECIPIENT-002',
    containersUsed: 1
  });
  logResponse(dist2);

  logStep(3, '核验第二条发放记录');
  const verifyRes = await apiRequest('POST', `/api/distribution/distributions/${dist2.body?.data?.id}/verify`, {
    verifiedBy: 'NURSE-002',
    notes: '核对批次号、有效期无误'
  });
  logResponse(verifyRes);

  logStep(4, '检查批次发放状态');
  const batchAfterDist = await apiRequest('GET', `/api/batches/${batchId}`);
  console.log('    发放后批次状态:', batchAfterDist.body?.data?.status);

  logSection('6. 批次追溯');
  logStep(1, '查询批次追溯路径');
  const trace = await apiRequest('GET', `/api/batches/${batchId}/traceability`);
  console.log('    捐赠人:', trace.body?.data?.donor_id);
  console.log('    影响的受者:', trace.body?.data?.affected_recipients?.join(', '));
  console.log('    追溯路径节点数:', trace.body?.data?.trace_path?.length);
  trace.body?.data?.trace_path?.forEach((node, i) => {
    console.log(`      ${i + 1}. ${node.type}: ${node.date || ''}`);
  });

  logSection('7. 库存报表');
  logStep(1, '生成库存总览报表');
  const inventory = await apiRequest('GET', '/api/reports/inventory');
  const inv = inventory.body?.data;
  console.log('    总捐赠数:', inv?.summary?.total_donations);
  console.log('    总批次数:', inv?.summary?.total_batches);
  console.log('    检测通过率:', inv?.test_pass_rate, '%');
  console.log('    冰箱分布:');
  inv?.freezers?.forEach(f => {
    console.log(`      - ${f.freezer_location}: ${f.batch_count}批次, ${f.total_volume}ml`);
  });

  logStep(2, '生成批次详细报告');
  const batchReport = await apiRequest('GET', `/api/reports/batch/${batchId}`);
  const br = batchReport.body?.data;
  console.log('    检测全部通过:', br?.testing?.all_tests_passed);
  console.log('    风险等级:', br?.risk_assessment?.overall_risk?.level);
  if (br?.risk_assessment?.overall_risk?.reasons?.length > 0) {
    console.log('    风险原因:', br.risk_assessment.overall_risk.reasons.join(', '));
  }

  logSection('8. 召回演练');
  logStep(1, '发现问题，发起召回');
  const recall = await apiRequest('POST', '/api/distribution/recalls', {
    batchId: batchId,
    reason: '检测设备校准后发现 HIV 检测结果存疑',
    notes: '需要联系所有受者'
  });
  logResponse(recall);
  recallId = recall.body?.data?.id;

  logStep(2, '检查召回后批次状态');
  const batchAfterRecall = await apiRequest('GET', `/api/batches/${batchId}`);
  console.log('    召回后批次状态:', batchAfterRecall.body?.data?.status);

  logStep(3, '检查召回后捐赠状态');
  const donationAfterRecall = await apiRequest('GET', `/api/donations/${donationId}`);
  console.log('    召回后捐赠状态:', donationAfterRecall.body?.data?.status);

  logStep(4, '更新召回进度');
  const updateRecall = await apiRequest('PATCH', `/api/distribution/recalls/${recallId}/status`, {
    status: 'partial',
    recalledQuantity: 100,
    recalledContainers: 1,
    notes: '已联系 RECIPIENT-002，成功追回1袋'
  });
  logResponse(updateRecall);

  logSection('9. 捐赠发放汇总');
  logStep(1, '查询捐赠发放汇总');
  const summary = await apiRequest('GET', `/api/distribution/donation-summary/${donationId}`);
  const s = summary.body?.data;
  console.log('    总捐赠量:', s?.total_donated, 'ml');
  console.log('    总冻存量:', s?.total_frozen, 'ml');
  console.log('    总发放量:', s?.total_distributed, 'ml');
  console.log('    受者数量:', s?.recipient_count);
  console.log('    涉及受者:', s?.recipients?.join(', '));
  console.log('    召回记录数:', s?.recall_count);

  console.log('\n' + '═'.repeat(60));
  console.log('  主流程演示完成！');
  console.log('═'.repeat(60) + '\n');
}

mainFlow().catch(console.error);
