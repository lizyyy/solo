const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: { raw: data }
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

function printDivider(title) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60));
}

function printResult(label, result) {
  console.log(`\n[${label}] HTTP ${result.statusCode}`);
  console.log(JSON.stringify(result.body, null, 2));
}

async function runScenario1_NormalProcessing() {
  printDivider('场景 1: 正常处理流程');
  console.log('目标: 验证站牌档案 -> 提交上报 -> 成功生成派修单');
  console.log('预期: 全部通过，返回 success=true');
  
  console.log('\n[步骤 1] 验证站牌档案 STOP-001');
  const verifyResult = await request('/api/stops/verify', 'POST', { stopId: 'STOP-001' });
  printResult('站牌验证', verifyResult);
  
  if (verifyResult.body.success && verifyResult.body.data.verificationResult === 'PASS') {
    console.log('\n✓ PASS: 站牌档案验证通过');
    console.log(`  - 站牌名称: ${verifyResult.body.data.stop.name}`);
    console.log(`  - 关联线路数: ${verifyResult.body.data.associatedRoutes.length}`);
  } else {
    console.log('\n✗ FAIL: 站牌验证失败');
  }
  
  console.log('\n[步骤 2] 设施维护队提交破损上报');
  const reportPayload = {
    teamId: 'TEAM-MAINT',
    stopId: 'STOP-001',
    reportType: 'DAMAGED',
    description: '站牌玻璃破碎，有安全隐患',
    reporterInfo: { name: '张三', phone: '13800138000' }
  };
  const reportResult = await request('/api/reports', 'POST', reportPayload);
  printResult('提交上报', reportResult);
  
  let reportId = null;
  if (reportResult.body.success && reportResult.body.data.processingResult === 'NEW_DISPATCH') {
    reportId = reportResult.body.data.report.id;
    console.log('\n✓ PASS: 上报成功，生成新派修单');
    console.log(`  - 上报 ID: ${reportId}`);
    console.log(`  - 派修单 ID: ${reportResult.body.data.dispatch.id}`);
    console.log(`  - 当前状态: ${reportResult.body.data.report.status}`);
  } else if (reportResult.body.success && reportResult.body.data.processingResult === 'MERGED') {
    reportId = reportResult.body.data.report.id;
    console.log('\n✓ PASS (合并): 系统自动去重，合并到已有派修单');
    console.log(`  - 上报 ID: ${reportId}`);
  } else {
    console.log('\n✗ FAIL: 上报失败');
  }
  
  console.log('\n[步骤 3] 查询上报详情（状态流转验证）');
  if (reportId) {
    const detailResult = await request(`/api/reports/${reportId}`, 'GET');
    printResult('上报详情', detailResult);
    
    if (detailResult.body.success) {
      const history = detailResult.body.data.report.statusHistory;
      console.log('\n✓ PASS: 状态流转记录');
      history.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.status} - ${h.comment} (${h.actor})`);
      });
    }
  }
  
  return reportId;
}

async function runScenario2_FailureReasons() {
  printDivider('场景 2: 失败场景与错误原因');
  console.log('目标: 验证各种业务校验失败时的错误返回');
  console.log('预期: 返回 success=false，包含错误码、消息和处理建议');
  
  const testCases = [
    {
      name: '路线版本不匹配',
      path: '/api/reports',
      method: 'POST',
      body: {
        teamId: 'TEAM-ROUTE',
        stopId: 'STOP-001',
        reportType: 'ROUTE_CHANGE',
        description: '线路调整',
        affectedRoutes: [{ routeId: 'ROUTE-01', version: 1 }]
      },
      expectedCode: 'ROUTE_VERSION_MISMATCH'
    },
    {
      name: '队伍越权上报',
      path: '/api/reports',
      method: 'POST',
      body: {
        teamId: 'TEAM-AD',
        stopId: 'STOP-001',
        reportType: 'DAMAGED',
        description: '越权上报破损'
      },
      expectedCode: 'REPORT_TYPE_INVALID'
    },
    {
      name: '站牌不存在',
      path: '/api/stops/verify',
      method: 'POST',
      body: { stopId: 'STOP-NOT-EXIST' },
      expectedCode: 'STOP_NOT_FOUND'
    }
  ];
  
  for (const tc of testCases) {
    console.log(`\n[测试用例] ${tc.name}`);
    const result = await request(tc.path, tc.method, tc.body);
    printResult('响应', result);
    
    if (!result.body.success && result.body.error?.code === tc.expectedCode) {
      console.log(`\n✓ PASS: 正确返回业务错误码 ${tc.expectedCode}`);
      console.log(`  - 错误消息: ${result.body.error.message}`);
      console.log(`  - 处理建议: ${result.body.actionRequired}`);
      console.log('  ▶ 需要人工处理: 根据 actionRequired 指引操作');
    } else {
      console.log(`\n✗ FAIL: 期望错误码 ${tc.expectedCode}`);
    }
  }
}

async function runScenario3_RetryAfterFix() {
  printDivider('场景 3: 修正后重跑流程');
  console.log('目标: 验证先失败、修正参数后重试成功的完整链路');
  
  console.log('\n[步骤 1] 先验证站牌（否则会失败）');
  await request('/api/stops/verify', 'POST', { stopId: 'STOP-002' });
  
  console.log('\n[步骤 2] 模拟线路版本错误的上报');
  const wrongPayload = {
    teamId: 'TEAM-ROUTE',
    stopId: 'STOP-002',
    reportType: 'ROUTE_CHANGE',
    description: '临时调整',
    affectedRoutes: [{ routeId: 'ROUTE-01', version: 99 }]
  };
  const failResult = await request('/api/reports', 'POST', wrongPayload);
  printResult('首次提交（应该失败）', failResult);
  
  if (!failResult.body.success && failResult.body.error?.code === 'ROUTE_VERSION_MISMATCH') {
    console.log('\n✓ PASS: 正确拦截版本不匹配');
    const { systemVersion, reportVersion } = failResult.body.error.details;
    console.log(`  - 系统版本: ${systemVersion}`);
    console.log(`  - 上报版本: ${reportVersion}`);
    console.log('  ▶ 修正动作: 将 version 改为 ' + systemVersion);
    
    console.log('\n[步骤 3] 使用正确版本重提上报');
    const fixedPayload = {
      ...wrongPayload,
      affectedRoutes: [{ routeId: 'ROUTE-01', version: systemVersion }]
    };
    const successResult = await request('/api/reports', 'POST', fixedPayload);
    printResult('修正后提交', successResult);
    
    if (successResult.body.success) {
      console.log('\n✓ PASS: 修正后提交成功');
      console.log(`  - 上报 ID: ${successResult.body.data.report.id}`);
      console.log(`  - 派修单 ID: ${successResult.body.data.dispatch.id}`);
    }
  }
}

async function runScenario4_DuplicateDetection() {
  printDivider('场景 4: 派修去重验证');
  console.log('目标: 验证同类重复上报会被自动合并，不重复派修');
  
  console.log('\n[步骤 1] 验证站牌 STOP-002');
  await request('/api/stops/verify', 'POST', { stopId: 'STOP-002' });
  
  console.log('\n[步骤 2] 第一次广告遮挡上报');
  const payload1 = {
    teamId: 'TEAM-AD',
    stopId: 'STOP-002',
    reportType: 'AD_BLOCKED',
    description: '小广告遮挡站牌'
  };
  const result1 = await request('/api/reports', 'POST', payload1);
  printResult('第一次上报', result1);
  
  if (result1.body.success && result1.body.data.processingResult === 'NEW_DISPATCH') {
    const dispatchId1 = result1.body.data.dispatch.id;
    console.log(`\n✓ PASS: 第一次上报生成派修单 ${dispatchId1}`);
    
    console.log('\n[步骤 3] 同类重复上报（同站牌同类型）');
    const payload2 = {
      teamId: 'TEAM-AD',
      stopId: 'STOP-002',
      reportType: 'AD_BLOCKED',
      description: '又发现同样的广告遮挡'
    };
    const result2 = await request('/api/reports', 'POST', payload2);
    printResult('重复上报', result2);
    
    if (result2.body.success && result2.body.data.processingResult === 'MERGED') {
      console.log('\n✓ PASS: 系统自动去重，合并到已有派修单');
      console.log(`  - 合并到的派修单: ${result2.body.data.dispatch.id}`);
      console.log('  ▶ 结果: 不会产生重复派修，节省资源');
    }
  }
}

async function runAll() {
  console.log('公交站牌破损上报 API - 验收测试');
  console.log('运行环境: Node.js + Express');
  console.log('服务地址: ' + BASE_URL);
  console.log('\n测试场景:');
  console.log('  1. 正常处理流程');
  console.log('  2. 失败原因展示');
  console.log('  3. 修正后重跑');
  console.log('  4. 派修去重验证');
  
  try {
    await runScenario1_NormalProcessing();
    await runScenario2_FailureReasons();
    await runScenario3_RetryAfterFix();
    await runScenario4_DuplicateDetection();
    
    printDivider('测试完成');
    console.log('\n验收判定标准:');
    console.log('');
    console.log('【通过判定】返回 success=true');
    console.log('  - 站牌验证: verificationResult === "PASS"');
    console.log('  - 首次上报: processingResult === "NEW_DISPATCH" 且有 dispatch.id');
    console.log('  - 状态流转: statusHistory 包含 SUBMITTED → VALIDATED → ROUTE_CHECKED → DISPATCHED');
    console.log('  - 去重合并: processingResult === "MERGED" 且 isDuplicate === true');
    console.log('');
    console.log('【需人工处理】返回 success=false');
    console.log('  - STOP_NOT_FOUND: 站牌不存在 → 先同步站牌档案');
    console.log('  - ROUTE_VERSION_MISMATCH: 线路版本不一致 → 同步最新版本后重报');
    console.log('  - REPORT_TYPE_INVALID: 队伍越权 → 切换正确队伍或上报类型');
    console.log('  - STOP_ARCHIVE_NOT_VERIFIED: 档案未验证 → 先调用 /api/stops/verify');
    console.log('');
    console.log('所有业务错误均包含 actionRequired 字段，直接告知下一步操作');
  } catch (err) {
    console.error('测试运行失败:', err.message);
    console.log('请先启动服务: npm run dev');
  }
}

runAll();
