const http = require('http');

const HOST = 'localhost';
const PORT = 3000;

function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData ? Buffer.byteLength(postData) : 0
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, ...parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, raw: data, error: e.message });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function printSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(label, result, passed) {
  const status = passed ? '✓ 通过' : '✗ 失败';
  console.log(`\n[${status}] ${label}`);
  console.log(`  HTTP状态: ${result.statusCode}`);
  if (result.status) console.log(`  业务状态: ${result.status}`);
  if (result.code) console.log(`  业务编码: ${result.code}`);
  if (result.message) console.log(`  消息: ${result.message}`);
  if (result.details) {
    console.log(`  详情:`);
    Object.entries(result.details).forEach(([key, val]) => {
      console.log(`    - ${key}:`, val.code || JSON.stringify(val));
    });
  }
}

let testPassed = 0;
let testFailed = 0;
let testManual = 0;

function recordTest(label, result, expectedStatus = 'PASS') {
  const passed = result.status === expectedStatus;
  printResult(label, result, passed);
  if (passed) testPassed++;
  else testFailed++;
  return passed;
}

async function checkServer() {
  try {
    const res = await httpRequest('GET', '/health');
    return res.statusCode === 200;
  } catch {
    return false;
  }
}

async function runScenario1_NormalFlow() {
  printSection('场景 1: 正常处理流程 - 无过敏宝宝领普通配方');

  console.log('\n1.1 验证宝宝档案 (B002 - 王乐乐, 11月龄, 无过敏史)');
  const babyInfo = await httpRequest('GET', '/api/babies/B002');
  recordTest('宝宝档案查询', babyInfo);

  console.log('\n1.2 验证批次 (BT20260503 - 伊利3段, 12-36月龄)');
  const batchInfo = await httpRequest('GET', '/api/batches/BT20260503');
  recordTest('批次查询', batchInfo);

  console.log('\n1.3 资格预检');
  const eligibility = await httpRequest('POST', '/api/check/eligibility', {
    babyId: 'B002',
    batchId: 'BT20260503'
  });
  recordTest('资格检查', eligibility);

  console.log('\n1.4 创建领取申请 (requestId: TEST-001)');
  const createResult = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-001',
    babyId: 'B002',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  const createPassed = recordTest('创建领取申请', createResult);
  const claimId = createResult.data?.claimId;
  if (claimId) console.log(`  生成的申领ID: ${claimId}`);

  console.log('\n1.5 重复提交同一requestId (幂等性测试)');
  const duplicateCreate = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-001',
    babyId: 'B002',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  recordTest('幂等创建', duplicateCreate);

  if (claimId && createPassed) {
    console.log('\n1.6 第一次推进 (pending -> approved)');
    const advance1 = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('推进到审核通过', advance1);

    console.log('\n1.7 第二次推进 (approved -> completed)');
    const advance2 = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('推进到完成', advance2);

    console.log('\n1.8 再次推进已完成的申请 (幂等性测试)');
    const advance3 = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('幂等推进', advance3);
  }

  return claimId;
}

async function runScenario2_FailureCases() {
  printSection('场景 2: 失败原因 - 各种资格不通过的情况');

  console.log('\n2.1 过敏原冲突 - 牛奶蛋白过敏宝宝领普通配方');
  const allergenConflict = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-002',
    babyId: 'B001',
    batchId: 'BT20260501',
    operator: 'TestRunner'
  });
  recordTest('过敏原冲突（应失败）', allergenConflict, 'FAIL');

  console.log('\n2.2 月龄不匹配 - 1月龄宝宝领3段(12-36月)');
  const ageMismatch = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-003',
    babyId: 'B003',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  recordTest('月龄不匹配（应失败）', ageMismatch, 'FAIL');

  console.log('\n2.3 已召回批次 - BT20260401');
  const recalledBatch = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-004',
    babyId: 'B002',
    batchId: 'BT20260401',
    operator: 'TestRunner'
  });
  recordTest('已召回批次（应失败）', recalledBatch, 'FAIL');

  console.log('\n2.4 重复领取 - B002已领取，再次申请');
  const duplicateClaim = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-005',
    babyId: 'B002',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  recordTest('重复领取（应失败）', duplicateClaim, 'FAIL');

  console.log('\n2.5 不存在的宝宝');
  const nonExistentBaby = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-006',
    babyId: 'B999',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  recordTest('不存在的宝宝（应失败）', nonExistentBaby, 'FAIL');
}

async function runScenario3_CorrectionAndRetry() {
  printSection('场景 3: 修正后重跑 - 过敏宝宝选错批次，修正后重新领取');

  console.log('\n3.1 过敏宝宝(B001)错误申请普通配方');
  const wrongClaim = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-007',
    babyId: 'B001',
    batchId: 'BT20260501',
    operator: 'TestRunner'
  });
  recordTest('错误申请（应失败）', wrongClaim, 'FAIL');

  console.log('\n3.2 检查水解配方(BT20260502 - 雀巢适度水解)');
  const hydroBatch = await httpRequest('GET', '/api/batches/BT20260502');
  recordTest('水解批次查询', hydroBatch);

  console.log('\n3.3 验证过敏宝宝是否符合水解配方');
  const checkResult = await httpRequest('POST', '/api/check/eligibility', {
    babyId: 'B001',
    batchId: 'BT20260502'
  });
  recordTest('资格检查（水解配方）', checkResult);

  console.log('\n3.4 重新申请 - 使用正确的水解配方批次');
  const newClaim = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-008',
    babyId: 'B001',
    batchId: 'BT20260502',
    operator: 'TestRunner'
  });
  const newClaimPassed = recordTest('重新申请（水解配方）', newClaim);
  const claimId = newClaim.data?.claimId;

  if (claimId && newClaimPassed) {
    console.log('\n3.5 推进领取流程');
    const advance1 = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('推进到审核通过', advance1);

    const advance2 = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('推进到完成', advance2);

    console.log('\n3.6 查看领取历史');
    const claimDetail = await httpRequest('GET', `/api/claims/${claimId}`);
    console.log('  领取详情:', {
      claimId: claimDetail.data?.claim?.claimId,
      status: claimDetail.data?.claim?.status,
      historyCount: claimDetail.data?.history?.length
    });
  }
}

async function runScenario4_Withdraw() {
  printSection('场景 4: 撤回流程');

  console.log('\n4.1 创建一个待撤回的申请');
  const claimToWithdraw = await httpRequest('POST', '/api/claims/create', {
    requestId: 'TEST-010',
    babyId: 'B004',
    batchId: 'BT20260503',
    operator: 'TestRunner'
  });
  recordTest('创建待撤回申请', claimToWithdraw);

  const claimId = claimToWithdraw.data?.claimId;

  if (claimId) {
    console.log('\n4.2 撤回申请');
    const withdrawResult = await httpRequest('POST', '/api/claims/withdraw', {
      claimId,
      reason: '用户主动取消',
      operator: 'TestRunner'
    });
    recordTest('撤回申请', withdrawResult);

    console.log('\n4.3 再次撤回同一申请（幂等性测试）');
    const withdrawAgain = await httpRequest('POST', '/api/claims/withdraw', {
      claimId,
      reason: '用户主动取消',
      operator: 'TestRunner'
    });
    recordTest('幂等撤回', withdrawAgain);

    console.log('\n4.4 尝试推进已撤回的申请（应失败）');
    const advanceWithdrawn = await httpRequest('POST', '/api/claims/advance', {
      claimId,
      operator: 'TestRunner'
    });
    recordTest('推进已撤回申请（应失败）', advanceWithdrawn, 'FAIL');
  }
}

async function runScenario5_Summary() {
  printSection('场景 5: 查询汇总');

  console.log('\n5.1 汇总查询');
  const summary = await httpRequest('GET', '/api/summary');
  console.log('  领取统计:', summary.data?.summary);
  console.log('  批次库存:');
  summary.data?.batches?.forEach(b => {
    console.log(`    ${b.batchId} (${b.brand}${b.stage}): ` +
      `${b.distributed}/${b.total} 已分发, 召回: ${b.recallStatus}`);
  });

  console.log('\n5.2 宝宝档案验证状态:');
  const babies = await httpRequest('GET', '/api/babies');
  babies.data?.forEach(b => {
    console.log(`    ${b.babyId} (${b.memberName}, ${b.months}月): ` +
      `档案${b.validation.status}, 过敏: ${b.allergies.join(',') || '无'}`);
  });
}

async function main() {
  console.log('\n' + '#'.repeat(60));
  console.log('#  母婴店奶粉试用装分发 API - 验收测试');
  console.log('#  测试目标: 正常处理、失败原因、修正重跑');
  console.log('#  边界维度: 宝宝月龄、过敏史、试用装批次');
  console.log('#'.repeat(60));

  printSection('测试准备');
  const serverReady = await checkServer();
  if (!serverReady) {
    console.log('  错误: 无法连接到服务');
    console.log('  请先运行: npm start');
    process.exit(1);
  }
  console.log('  ✓ 服务运行正常');

  await runScenario1_NormalFlow();
  await runScenario2_FailureCases();
  await runScenario3_CorrectionAndRetry();
  await runScenario4_Withdraw();
  await runScenario5_Summary();

  printSection('验收测试完成');
  const total = testPassed + testFailed + testManual;
  console.log('\n测试统计:');
  console.log(`  通过: ${testPassed}`);
  console.log(`  失败: ${testFailed}`);
  console.log(`  人工: ${testManual}`);
  console.log(`  总计: ${total}`);

  console.log('\n输出规范说明:');
  console.log('  status=PASS   → ✓ 自动通过，无需人工处理');
  console.log('  status=FAIL   → ✗ 系统拦截，需要检查原因');
  console.log('  status=MANUAL → ? 需要人工审核确认');

  console.log('\n业务编码规范:');
  console.log('  *_CREATED / *_APPROVED / *_COMPLETED  → 正常');
  console.log('  *_FAILED  / *_REJECTED / *_TERMINATED → 失败');
  console.log('  IDEMPOTENT_*                          → 幂等保护');

  process.exit(testFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('测试运行出错:', err);
  process.exit(1);
});
