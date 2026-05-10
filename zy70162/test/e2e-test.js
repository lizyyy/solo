const http = require('http');

const BASE_URL = 'http://localhost:3000';

let testResults = [];
let safeTaskId = null;
let quarantinedTaskId = null;
let reviewId = null;

const request = (options, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Actor': options.actor || 'test-user',
          ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              statusCode: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              statusCode: res.statusCode,
              data: { raw: data }
            });
          }
        });
      }
    );
    
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const assert = (condition, testName, message) => {
  const passed = !!condition;
  testResults.push({
    name: testName,
    passed,
    message: passed ? '通过' : message
  });
  
  const statusIcon = passed ? '✅' : '❌';
  console.log(`  ${statusIcon} ${testName}`);
  if (!passed && message) {
    console.log(`     原因: ${message}`);
  }
  
  return passed;
};

const printSection = (title) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runTests = async () => {
  console.log('\n文件病毒扫描回调服务 - 端到端测试');
  console.log('='.repeat(60));
  
  try {
    printSection('1. 健康检查');
    const healthRes = await request({ method: 'GET', path: '/health' });
    assert(
      healthRes.statusCode === 200 && healthRes.data.status === 'ok',
      '服务健康状态正常',
      `期望 200/ok，实际 ${healthRes.statusCode}/${healthRes.data.status}`
    );
    
    printSection('2. 主流程测试 - 安全文件扫描');
    console.log('  2.1 创建文件任务');
    const createRes = await request(
      { method: 'POST', path: '/api/tasks/create', actor: 'uploader-zhang' },
      {
        fileName: '安全文档.pdf',
        fileSize: 1024000,
        businessId: 'order-2024-001'
      }
    );
    safeTaskId = createRes.data.data?.taskId;
    assert(
      createRes.statusCode === 200 && createRes.data.code === 'TASK_CREATED' && safeTaskId,
      '任务创建成功',
      `期望 200/TASK_CREATED，实际 ${createRes.statusCode}/${createRes.data.code}`
    );
    
    console.log('  2.2 查询任务状态（待扫描）');
    const taskPendingRes = await request({ method: 'GET', path: `/api/tasks/${safeTaskId}` });
    assert(
      taskPendingRes.statusCode === 200 && taskPendingRes.data.data?.status === 'pending',
      '任务状态为「等待扫描」',
      `期望 pending，实际 ${taskPendingRes.data.data?.status}`
    );
    
    console.log('  2.3 尝试下载待扫描文件（应被拦截）');
    const downloadPendingRes = await request(
      { method: 'POST', path: `/api/tasks/${safeTaskId}/check-download`, actor: 'user-li' },
      {}
    );
    assert(
      downloadPendingRes.statusCode === 200 && 
      downloadPendingRes.data.data?.permission === 'blocked',
      '待扫描文件被成功拦截',
      `期望 blocked，实际 ${downloadPendingRes.data.data?.permission}`
    );
    if (downloadPendingRes.data.data?.rule_applied) {
      console.log(`     拦截规则: ${downloadPendingRes.data.data.rule_applied}`);
      console.log(`     拦截原因: ${downloadPendingRes.data.message}`);
    }
    
    console.log('  2.4 提交病毒扫描回调（安全）');
    const scanSafeRes = await request(
      { method: 'POST', path: `/api/tasks/${safeTaskId}/scan-callback`, actor: 'scan-engine-clamav' },
      {
        isSafe: true,
        engine: 'ClamAV'
      }
    );
    assert(
      scanSafeRes.statusCode === 200 && 
      scanSafeRes.data.code === 'SCAN_COMPLETED_SAFE' &&
      scanSafeRes.data.data?.newStatus === 'safe',
      '扫描回调处理成功，状态变为「安全」',
      `期望 200/SCAN_COMPLETED_SAFE，实际 ${scanSafeRes.statusCode}/${scanSafeRes.data.code}`
    );
    
    console.log('  2.5 尝试下载安全文件（应允许）');
    const downloadSafeRes = await request(
      { method: 'POST', path: `/api/tasks/${safeTaskId}/check-download`, actor: 'user-li' },
      {}
    );
    assert(
      downloadSafeRes.statusCode === 200 && 
      downloadSafeRes.data.data?.permission === 'allowed',
      '安全文件允许下载',
      `期望 allowed，实际 ${downloadSafeRes.data.data?.permission}`
    );
    
    printSection('3. 主流程测试 - 病毒文件隔离');
    console.log('  3.1 创建另一个文件任务');
    const createVirusRes = await request(
      { method: 'POST', path: '/api/tasks/create', actor: 'uploader-wang' },
      {
        fileName: '可疑附件.zip',
        fileSize: 512000,
        businessId: 'order-2024-002'
      }
    );
    quarantinedTaskId = createVirusRes.data.data?.taskId;
    assert(
      createVirusRes.statusCode === 200 && quarantinedTaskId,
      '任务创建成功',
      `期望 200，实际 ${createVirusRes.statusCode}`
    );
    
    console.log('  3.2 提交病毒扫描回调（发现威胁）');
    const scanThreatRes = await request(
      { method: 'POST', path: `/api/tasks/${quarantinedTaskId}/scan-callback`, actor: 'scan-engine-clamav' },
      {
        isSafe: false,
        engine: 'ClamAV',
        threatType: 'Trojan.Win32.Agent',
        threatDetails: '检测到木马程序'
      }
    );
    assert(
      scanThreatRes.statusCode === 200 && 
      scanThreatRes.data.code === 'SCAN_COMPLETED_THREAT' &&
      scanThreatRes.data.data?.newStatus === 'quarantined',
      '发现威胁，文件被隔离',
      `期望 200/SCAN_COMPLETED_THREAT，实际 ${scanThreatRes.statusCode}/${scanThreatRes.data.code}`
    );
    
    console.log('  3.3 尝试下载已隔离文件（应被拦截）');
    const downloadQuarantinedRes = await request(
      { method: 'POST', path: `/api/tasks/${quarantinedTaskId}/check-download`, actor: 'user-li' },
      {}
    );
    assert(
      downloadQuarantinedRes.statusCode === 200 && 
      downloadQuarantinedRes.data.data?.permission === 'blocked',
      '已隔离文件被成功拦截',
      `期望 blocked，实际 ${downloadQuarantinedRes.data.data?.permission}`
    );
    if (downloadQuarantinedRes.data.data?.rule_applied) {
      console.log(`     拦截规则: ${downloadQuarantinedRes.data.data.rule_applied}`);
      console.log(`     拦截原因: ${downloadQuarantinedRes.data.message}`);
    }
    
    printSection('4. 边界条件测试 - 误报审核流程');
    console.log('  4.1 尝试为安全文件申请误报审核（应失败）');
    const badRequestRes = await request(
      { method: 'POST', path: `/api/tasks/${safeTaskId}/request-false-positive`, actor: 'user-li' },
      { reason: '测试错误状态申请' }
    );
    assert(
      badRequestRes.statusCode === 400 && 
      badRequestRes.data.code === 'INVALID_STATUS',
      '只有已隔离文件才能申请误报审核',
      `期望 400/INVALID_STATUS，实际 ${badRequestRes.statusCode}/${badRequestRes.data.code}`
    );
    
    console.log('  4.2 为已隔离文件申请误报审核');
    const fpRequestRes = await request(
      { method: 'POST', path: `/api/tasks/${quarantinedTaskId}/request-false-positive`, actor: 'user-li' },
      { reason: '该文件是内部开发工具，被误判为病毒' }
    );
    reviewId = fpRequestRes.data.data?.reviewId;
    assert(
      fpRequestRes.statusCode === 200 && 
      fpRequestRes.data.code === 'FALSE_POSITIVE_REQUESTED' &&
      reviewId,
      '误报审核申请提交成功',
      `期望 200/FALSE_POSITIVE_REQUESTED，实际 ${fpRequestRes.statusCode}/${fpRequestRes.data.code}`
    );
    
    console.log('  4.3 查询任务状态（应变为审核中）');
    const taskReviewingRes = await request({ method: 'GET', path: `/api/tasks/${quarantinedTaskId}` });
    assert(
      taskReviewingRes.statusCode === 200 && 
      taskReviewingRes.data.data?.status === 'reviewing',
      '任务状态变为「审核中」',
      `期望 reviewing，实际 ${taskReviewingRes.data.data?.status}`
    );
    
    console.log('  4.4 管理员审核通过误报申请');
    const reviewApproveRes = await request(
      { method: 'POST', path: '/api/admin/review-false-positive', actor: 'admin-zhao' },
      {
        reviewId: reviewId,
        isApproved: true,
        comment: '经核实，该文件确为内部工具，予以放行'
      }
    );
    assert(
      reviewApproveRes.statusCode === 200 && 
      reviewApproveRes.data.code === 'FALSE_POSITIVE_APPROVED',
      '误报审核通过',
      `期望 200/FALSE_POSITIVE_APPROVED，实际 ${reviewApproveRes.statusCode}/${reviewApproveRes.data.code}`
    );
    
    console.log('  4.5 再次查询任务状态（应变为已解除隔离）');
    const taskUnquarantinedRes = await request({ method: 'GET', path: `/api/tasks/${quarantinedTaskId}` });
    assert(
      taskUnquarantinedRes.statusCode === 200 && 
      taskUnquarantinedRes.data.data?.status === 'unquarantined',
      '任务状态变为「已解除隔离」',
      `期望 unquarantined，实际 ${taskUnquarantinedRes.data.data?.status}`
    );
    
    console.log('  4.6 尝试下载解除隔离的文件（应允许）');
    const downloadUnquarantinedRes = await request(
      { method: 'POST', path: `/api/tasks/${quarantinedTaskId}/check-download`, actor: 'user-li' },
      {}
    );
    assert(
      downloadUnquarantinedRes.statusCode === 200 && 
      downloadUnquarantinedRes.data.data?.permission === 'allowed',
      '解除隔离后文件允许下载',
      `期望 allowed，实际 ${downloadUnquarantinedRes.data.data?.permission}`
    );
    
    printSection('5. 审计追踪测试');
    console.log('  5.1 查询安全文件的审计轨迹');
    const auditSafeRes = await request({ 
      method: 'GET', 
      path: `/api/admin/audit/trail/${safeTaskId}` 
    });
    const safeActions = auditSafeRes.data.data?.map(item => item.action) || [];
    assert(
      auditSafeRes.statusCode === 200 && 
      safeActions.includes('task_created') &&
      safeActions.includes('scan_completed_safe') &&
      safeActions.includes('download_allowed'),
      '审计轨迹包含关键操作记录',
      `期望包含 task_created/scan_completed_safe/download_allowed，实际: ${safeActions.join(', ')}`
    );
    console.log(`     记录到 ${auditSafeRes.data.data?.length} 条审计记录`);
    
    console.log('  5.2 查询误报文件的审计轨迹（验证状态变更链）');
    const auditFpRes = await request({ 
      method: 'GET', 
      path: `/api/admin/audit/trail/${quarantinedTaskId}` 
    });
    const fpStatusChanges = auditFpRes.data.data?.filter(item => item.old_status || item.new_status) || [];
    const expectedTransitions = [
      { from: null, to: 'pending' },
      { from: 'pending', to: 'quarantined' },
      { from: 'quarantined', to: 'reviewing' },
      { from: 'reviewing', to: 'unquarantined' }
    ];
    const transitionsValid = expectedTransitions.every(expected => {
      return fpStatusChanges.some(change => 
        change.old_status === expected.from && change.new_status === expected.to
      );
    });
    assert(
      auditFpRes.statusCode === 200 && transitionsValid,
      '状态流转可追溯: pending → quarantined → reviewing → unquarantined',
      '状态流转记录不完整'
    );
    console.log(`     状态变更记录数: ${fpStatusChanges.length}`);
    
    console.log('  5.3 按操作类型查询审计日志');
    const auditQueryRes = await request({ 
      method: 'GET', 
      path: '/api/admin/audit/query?action=download_blocked' 
    });
    assert(
      auditQueryRes.statusCode === 200 && 
      auditQueryRes.data.data?.length >= 2,
      '查询到被拦截的下载记录',
      `期望至少 2 条，实际 ${auditQueryRes.data.data?.length}`
    );
    
    printSection('6. 规则可复查测试');
    console.log('  6.1 查询所有下载规则');
    const rulesRes = await request({ method: 'GET', path: '/api/admin/rules' });
    const downloadRules = rulesRes.data.data?.filter(r => r.ruleType === 'download') || [];
    assert(
      rulesRes.statusCode === 200 && downloadRules.length >= 6,
      '下载规则可查询，共 6 条默认规则',
      `期望至少 6 条下载规则，实际 ${downloadRules.length}`
    );
    
    console.log('  6.2 验证规则优先级排序');
    const priorities = downloadRules.map(r => r.priority);
    const isSorted = priorities.every((p, i) => i === 0 || priorities[i-1] >= p);
    assert(
      isSorted,
      '规则按优先级从高到低排列',
      `优先级顺序: ${priorities.join(' > ')}`
    );
    
    const pendingRule = downloadRules.find(r => r.ruleName === 'default_pending_download');
    const safeRule = downloadRules.find(r => r.ruleName === 'default_safe_download');
    console.log(`     待扫描文件规则优先级: ${pendingRule?.priority}`);
    console.log(`     安全文件规则优先级: ${safeRule?.priority}`);
    console.log(`     待扫描规则优先于安全规则: ${pendingRule?.priority > safeRule?.priority}`);
    
    printSection('7. 统计查询测试');
    console.log('  7.1 查询整体统计');
    const statsRes = await request({ method: 'GET', path: '/api/admin/stats' });
    assert(
      statsRes.statusCode === 200 && 
      statsRes.data.data?.total >= 2 &&
      statsRes.data.data?.byStatus?.some(s => s.status === 'safe' && s.count >= 1) &&
      statsRes.data.data?.byStatus?.some(s => s.status === 'unquarantined' && s.count >= 1),
      '统计信息正确反映当前状态',
      `总任务数: ${statsRes.data.data?.total}`
    );
    if (statsRes.data.data?.byStatus) {
      statsRes.data.data.byStatus.forEach(s => {
        if (s.count > 0) {
          console.log(`     ${s.statusDescription}: ${s.count} 个`);
        }
      });
    }
    
    printSection('8. 业务关联查询测试');
    console.log('  8.1 按业务ID查询所有文件任务');
    const businessTasksRes = await request({ 
      method: 'GET', 
      path: '/api/tasks/business/order-2024-001' 
    });
    assert(
      businessTasksRes.statusCode === 200 && 
      businessTasksRes.data.data?.length >= 1,
      '可按业务标识查询关联文件',
      `期望至少 1 个任务，实际 ${businessTasksRes.data.data?.length}`
    );
    
    printSection('测试结果汇总');
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`\n总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${total - passed}`);
    console.log(`通过率: ${Math.round((passed / total) * 100)}%`);
    
    if (total === passed) {
      console.log('\n✅ 所有测试通过！');
      console.log('\n验收要点总结:');
      console.log('  📁 文件任务: 创建、查询、按业务ID关联');
      console.log('  🔍 扫描回调: 异步处理安全/威胁两种结果');
      console.log('  🚫 下载拦截: 基于规则引擎，可追溯拦截原因');
      console.log('  ✅ 误报放行: 完整的申请-审核-放行流程');
      console.log('  📋 审计查询: 完整的状态流转历史记录');
      console.log('  📜 规则可查: 6条默认下载规则，优先级透明');
      process.exit(0);
    } else {
      console.log('\n❌ 部分测试失败:');
      testResults.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`);
      });
      process.exit(1);
    }
    
  } catch (err) {
    console.error('\n❌ 测试执行出错:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

runTests();
