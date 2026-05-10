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

function apiRequest(method, path, body = null, headers = {}) {
  const url = new URL(BASE_URL + path);
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Content-Length': body ? Buffer.byteLength(JSON.stringify(body)) : 0
  };
  return request({
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname + url.search,
    method: method,
    headers: { ...defaultHeaders, ...headers }
  }, body);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log('  ' + title);
  console.log('═'.repeat(60));
}

function logStep(num, description, expected) {
  console.log(`\n  [异常场景 ${num}] ${description}`);
  console.log('    预期结果:', expected);
}

function logError(res) {
  console.log('    实际状态码:', res.statusCode);
  if (res.body?.error) {
    console.log('    实际错误:', res.body.error);
  }
  if (res.body?.code) {
    console.log('    错误代码:', res.body.code);
  }
}

async function errorCasesDemo() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(8) + '母乳库 API - 异常操作演示' + ' '.repeat(8) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');

  logSection('一、捐赠登记异常');
  
  logStep(1, '缺少必要字段', '返回 400，提示缺少字段');
  const missingFields = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-001'
  });
  logError(missingFields);
  console.log('    验证:', missingFields.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(2, '捐赠量为0或负数', '返回 400，提示数量无效');
  const zeroQty = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-002',
    donationDate: '2026-05-10',
    quantityMl: 0
  });
  logError(zeroQty);
  console.log('    验证:', zeroQty.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logSection('二、检测录入异常');
  
  logStep(1, '对不存在的捐赠录入检测', '返回 400');
  const invalidDonationTest = await apiRequest('POST', '/api/tests', {
    donationId: 'non-existent-id-123',
    testType: 'hiv',
    result: 'negative',
    testDate: '2026-05-10'
  });
  logError(invalidDonationTest);

  logStep(2, '使用无效的检测类型', '返回 400，提示检测类型无效');
  const invalidTestType = await apiRequest('POST', '/api/tests', {
    donationId: 'some-id',
    testType: 'covid19',
    result: 'negative',
    testDate: '2026-05-10'
  });
  logError(invalidTestType);
  console.log('    验证:', invalidTestType.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(3, '同一检测类型重复录入', '返回已有记录，不创建新记录');
  const normalDonation = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-003',
    donationDate: '2026-05-10',
    quantityMl: 100
  });
  const donationId = normalDonation.body?.data?.id;

  const firstTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'hiv',
    result: 'negative',
    testDate: '2026-05-10'
  });
  const firstTestId = firstTest.body?.data?.id;

  const duplicateTest = await apiRequest('POST', '/api/tests', {
    donationId: donationId,
    testType: 'hiv',
    result: 'positive',
    testDate: '2026-05-10'
  });
  console.log('    首次检测 ID:', firstTestId);
  console.log('    重复检测 ID:', duplicateTest.body?.data?.id);
  console.log('    重复检测结果:', duplicateTest.body?.data?.result);
  console.log('    验证:', (firstTestId === duplicateTest.body?.data?.id) && (duplicateTest.body?.data?.result === 'negative') ? '✓ 正确 (返回首次记录，未被覆盖)' : '✗ 错误');

  logSection('三、冻存批次异常');
  
  logStep(1, '检测未完成就冻存', '返回 400，提示未通过检测');
  const incompleteDonation = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-004',
    donationDate: '2026-05-10',
    quantityMl: 200
  });
  const incompleteId = incompleteDonation.body?.data?.id;

  const freezeWithoutTests = await apiRequest('POST', '/api/batches', {
    donationId: incompleteId,
    containerType: 'bag_100ml',
    containerCount: 2,
    freezerLocation: 'FREEZER-A'
  });
  logError(freezeWithoutTests);
  console.log('    验证:', freezeWithoutTests.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(2, '检测不合格的捐赠尝试冻存', '返回 400');
  const badDonation = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-005',
    donationDate: '2026-05-10',
    quantityMl: 100
  });
  const badDonationId = badDonation.body?.data?.id;

  await apiRequest('POST', '/api/tests', {
    donationId: badDonationId,
    testType: 'hiv',
    result: 'positive',
    testDate: '2026-05-10'
  });

  const freezeBadDonation = await apiRequest('POST', '/api/batches', {
    donationId: badDonationId,
    containerType: 'bag_50ml',
    containerCount: 1,
    freezerLocation: 'FREEZER-A'
  });
  logError(freezeBadDonation);
  console.log('    验证:', freezeBadDonation.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(3, '冻存数量超过捐赠总量', '返回 400，提示超出剩余量');
  const goodDonation = await apiRequest('POST', '/api/donations', {
    donorId: 'ERROR-DONOR-006',
    donationDate: '2026-05-10',
    quantityMl: 100
  });
  const goodDonationId = goodDonation.body?.data?.id;

  const criticalTests = ['hiv', 'htlv', 'hbsag', 'syphilis', 'bacterial_culture'];
  for (const testType of criticalTests) {
    await apiRequest('POST', '/api/tests', {
      donationId: goodDonationId,
      testType: testType,
      result: 'negative',
      testDate: '2026-05-10'
    });
  }

  const overFreeze = await apiRequest('POST', '/api/batches', {
    donationId: goodDonationId,
    containerType: 'bag_100ml',
    containerCount: 5,
    freezerLocation: 'FREEZER-A'
  });
  logError(overFreeze);
  console.log('    验证:', overFreeze.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logSection('四、发放核验异常');
  
  logStep(1, '发放超过库存的数量', '返回 400，提示超出可用库存');
  const batchCreate = await apiRequest('POST', '/api/batches', {
    donationId: goodDonationId,
    containerType: 'bag_100ml',
    containerCount: 1,
    freezerLocation: 'FREEZER-A'
  });
  const batchId = batchCreate.body?.data?.id;

  const overDistribute = await apiRequest('POST', '/api/distribution/distribute', {
    batchId: batchId,
    recipientId: 'RECIPIENT-ERROR',
    containersUsed: 10
  });
  logError(overDistribute);
  console.log('    验证:', overDistribute.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(2, '对不存在的批次发起发放', '返回 400');
  const invalidBatchDistribute = await apiRequest('POST', '/api/distribution/distribute', {
    batchId: 'non-existent-batch',
    recipientId: 'RECIPIENT-ERROR',
    containersUsed: 1
  });
  logError(invalidBatchDistribute);

  logStep(3, '核验时未提供核验人', '返回 400');
  const distributeRes = await apiRequest('POST', '/api/distribution/distribute', {
    batchId: batchId,
    recipientId: 'RECIPIENT-VERIFY-TEST',
    containersUsed: 1
  });
  const distId = distributeRes.body?.data?.id;

  const verifyNoVerifier = await apiRequest('POST', `/api/distribution/distributions/${distId}/verify`, {});
  logError(verifyNoVerifier);
  console.log('    验证:', verifyNoVerifier.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logSection('五、召回异常');
  
  logStep(1, '召回未提供原因', '返回 400');
  const recallNoReason = await apiRequest('POST', '/api/distribution/recalls', {
    batchId: batchId
  });
  logError(recallNoReason);
  console.log('    验证:', recallNoReason.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logSection('六、幂等性演示');
  
  logStep(1, '相同 requestId 的重复请求', '只创建1条记录');
  const requestId = 'demo-idempotent-' + Date.now();

  const req1 = await apiRequest('POST', '/api/donations', {
    donorId: 'IDEMPOTENT-DONOR',
    donationDate: '2026-05-10',
    quantityMl: 100
  }, { 'x-request-id': requestId });

  const req2 = await apiRequest('POST', '/api/donations', {
    donorId: 'IDEMPOTENT-DONOR',
    donationDate: '2026-05-10',
    quantityMl: 100
  }, { 'x-request-id': requestId });

  console.log('    第一次请求 ID:', req1.body?.data?.id);
  console.log('    第二次请求 ID:', req2.body?.data?.id);
  console.log('    第一次创建时间:', req1.body?.data?.created_at);
  console.log('    第二次创建时间:', req2.body?.data?.created_at);

  const listRes = await apiRequest('GET', '/api/donations?donorId=IDEMPOTENT-DONOR');
  console.log('    该捐赠人实际记录数:', listRes.body?.count);
  console.log('    验证:', (req1.body?.data?.id === req2.body?.data?.id) && (listRes.body?.count === 1) ? '✓ 正确 (幂等性生效)' : '✗ 错误');

  logSection('七、撤回操作');
  
  logStep(1, '撤回未提供原因', '返回 400');
  const withdrawNoReason = await apiRequest('POST', `/api/donations/${donationId}/withdraw`, {});
  logError(withdrawNoReason);
  console.log('    验证:', withdrawNoReason.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  logStep(2, '正常撤回（提供原因）', '成功，状态变为 withdrawn');
  const withdrawWithReason = await apiRequest('POST', `/api/donations/${donationId}/withdraw`, {
    reason: '捐赠人要求撤回，身体不适'
  });
  console.log('    撤回后状态:', withdrawWithReason.body?.data?.status);
  console.log('    撤回后备注:', withdrawWithReason.body?.data?.notes);
  console.log('    验证:', withdrawWithReason.body?.data?.status === 'withdrawn' ? '✓ 正确' : '✗ 错误');

  logSection('八、状态转换约束');
  
  logStep(1, '已撤回的捐赠尝试冻存', '返回 400');
  const freezeWithdrawn = await apiRequest('POST', '/api/batches', {
    donationId: donationId,
    containerType: 'bag_50ml',
    containerCount: 1,
    freezerLocation: 'FREEZER-A'
  });
  logError(freezeWithdrawn);

  logStep(2, '无效的状态转换', '返回 400，提示无法转换');
  const invalidStatus = await apiRequest('PATCH', `/api/donations/${goodDonationId}/status`, {
    status: 'distributed'
  });
  logError(invalidStatus);
  console.log('    验证:', invalidStatus.statusCode === 400 ? '✓ 正确' : '✗ 错误');

  console.log('\n' + '═'.repeat(60));
  console.log('  异常操作演示完成！');
  console.log('═'.repeat(60) + '\n');
}

errorCasesDemo().catch(console.error);
