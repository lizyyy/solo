const http = require('http');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api/cache';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function apiCall(method, path, data = null) {
  const url = new URL(API_BASE + path);
  const options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  return request(options, data);
}

const testResults = [];

function logTest(name, input, expected, actual, passed) {
  const result = {
    name,
    input,
    expected,
    actual,
    passed,
    timestamp: new Date().toISOString()
  };
  testResults.push(result);
  
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}: ${name}`);
  if (!passed) {
    console.log(`  期望: ${JSON.stringify(expected)}`);
    console.log(`  实际: ${JSON.stringify(actual)}`);
  }
}

async function runNormalTests() {
  console.log('\n========================================');
  console.log('测试组1: 正常流程记录');
  console.log('========================================\n');

  console.log('测试1.1: 创建降级记录');
  const createInput = {
    cache_key: 'hot:user:10001',
    business_line: '用户中心',
    degrade_reason: '热点Key流量突增, QPS达5000',
    executor: '运维A'
  };
  const createResult = await apiCall('POST', '/degrade', createInput);
  logTest(
    '创建降级记录',
    createInput,
    { success: true, statusCode: 200 },
    { success: createResult.body.success, statusCode: createResult.status },
    createResult.status === 200 && createResult.body.success
  );
  const recordId = createResult.body.data?.id;

  console.log('\n测试1.2: 查询降级记录');
  const queryResult = await apiCall('GET', '/records');
  logTest(
    '查询降级记录',
    '无参数',
    { success: true, hasData: true },
    { success: queryResult.body.success, hasData: queryResult.body.data.length > 0 },
    queryResult.status === 200 && queryResult.body.success && queryResult.body.data.length > 0
  );

  console.log('\n测试1.3: 申请恢复');
  const restoreInput = { applicant: '开发B' };
  const restoreResult = await apiCall('POST', `/restore/${recordId}`, restoreInput);
  logTest(
    '申请恢复',
    { recordId, ...restoreInput },
    { success: true, statusCode: 200 },
    { success: restoreResult.body.success, statusCode: restoreResult.status },
    restoreResult.status === 200 && restoreResult.body.success
  );

  console.log('\n测试1.4: 记录缓存命中并标记清理');
  const hitInput = { cache_key: 'hot:user:10001', value_type: 'string', is_null_cache: false };
  const hitResult = await apiCall('POST', '/cache-hit', hitInput);
  logTest(
    '缓存命中并标记清理',
    hitInput,
    { success: true, cleanupMarked: true },
    { success: hitResult.body.success, cleanupMarked: !!hitResult.body.data.cleanup_marked },
    hitResult.status === 200 && hitResult.body.success && !!hitResult.body.data.cleanup_marked
  );
  const taskId = hitResult.body.data.cleanup_marked?.taskId;

  console.log('\n测试1.5: 查询待清理任务');
  const tasksResult = await apiCall('GET', '/cleanup-tasks?status=pending');
  logTest(
    '查询待清理任务',
    { status: 'pending' },
    { success: true, hasTasks: true },
    { success: tasksResult.body.success, hasTasks: tasksResult.body.data.length > 0 },
    tasksResult.status === 200 && tasksResult.body.success && tasksResult.body.data.length > 0
  );

  console.log('\n测试1.6: 确认清理完成');
  const confirmInput = { operator: '运维C' };
  const confirmResult = await apiCall('POST', `/cleanup/${taskId}/confirm`, confirmInput);
  logTest(
    '确认清理完成',
    { taskId, ...confirmInput },
    { success: true, statusCode: 200 },
    { success: confirmResult.body.success, statusCode: confirmResult.status },
    confirmResult.status === 200 && confirmResult.body.success
  );

  console.log('\n测试1.7: 导出降级记录(CSV)');
  const exportResult = await apiCall('GET', '/export/records?format=csv');
  logTest(
    '导出降级记录',
    { format: 'csv' },
    { success: true, statusCode: 200 },
    { statusCode: exportResult.status, hasData: typeof exportResult.body === 'string' || exportResult.status === 200 },
    exportResult.status === 200
  );
}

async function runExceptionTests() {
  console.log('\n========================================');
  console.log('测试组2: 异常流程记录');
  console.log('========================================\n');

  console.log('测试2.1: 创建降级记录缺少必填字段');
  const missingFieldInput = { cache_key: 'test:1', business_line: '测试' };
  const missingFieldResult = await apiCall('POST', '/degrade', missingFieldInput);
  logTest(
    '创建降级缺少必填字段',
    missingFieldInput,
    { success: false, statusCode: 400 },
    { success: missingFieldResult.body.success, statusCode: missingFieldResult.status },
    missingFieldResult.status === 400 && !missingFieldResult.body.success
  );

  console.log('\n测试2.2: 申请恢复不存在的记录');
  const restoreInvalidResult = await apiCall('POST', '/restore/999999', { applicant: '测试' });
  logTest(
    '恢复不存在的记录',
    { recordId: 999999 },
    { success: false, statusCode: 400 },
    { success: restoreInvalidResult.body.success, statusCode: restoreInvalidResult.status },
    restoreInvalidResult.status === 400 && !restoreInvalidResult.body.success
  );

  console.log('\n测试2.3: 确认清理不存在的任务');
  const confirmInvalidResult = await apiCall('POST', '/cleanup/999999/confirm', { operator: '测试' });
  logTest(
    '确认清理不存在的任务',
    { taskId: 999999 },
    { success: false, statusCode: 400 },
    { success: confirmInvalidResult.body.success, statusCode: confirmInvalidResult.status },
    confirmInvalidResult.status === 400 && !confirmInvalidResult.body.success
  );

  console.log('\n测试2.4: 重复降级同一Key');
  const repeatKey = 'repeat:test:key';
  await apiCall('POST', '/degrade', {
    cache_key: repeatKey,
    business_line: '测试线',
    degrade_reason: '测试重复降级',
    executor: '测试'
  });
  const repeatResult = await apiCall('POST', '/degrade', {
    cache_key: repeatKey,
    business_line: '测试线',
    degrade_reason: '测试重复降级',
    executor: '测试'
  });
  logTest(
    '重复降级同一Key',
    { cache_key: repeatKey },
    { success: false, statusCode: 400 },
    { success: repeatResult.body.success, statusCode: repeatResult.status },
    repeatResult.status === 400 && !repeatResult.body.success
  );

  console.log('\n测试2.5: 状态流转异常 - 已恢复的记录不能再次恢复');
  const createForStateTest = await apiCall('POST', '/degrade', {
    cache_key: 'state:test:1',
    business_line: '测试线',
    degrade_reason: '状态流转测试',
    executor: '测试'
  });
  const testRecordId = createForStateTest.body.data?.id;
  await apiCall('POST', `/restore/${testRecordId}`, { applicant: '测试' });
  const doubleRestoreResult = await apiCall('POST', `/restore/${testRecordId}`, { applicant: '测试' });
  logTest(
    '重复申请恢复',
    { recordId: testRecordId },
    { success: false, statusCode: 400 },
    { success: doubleRestoreResult.body.success, statusCode: doubleRestoreResult.status },
    doubleRestoreResult.status === 400 && !doubleRestoreResult.body.success
  );
}

async function runRepeatTests() {
  console.log('\n========================================');
  console.log('测试组3: 重复运行记录');
  console.log('========================================\n');

  let lastRecordId = null;
  let successfulRestores = 0;

  for (let i = 1; i <= 5; i++) {
    console.log(`测试3.${i}: 第${i}次完整流程`);
    
    const key = `repeat:flow:${i}`;
    const createResult = await apiCall('POST', '/degrade', {
      cache_key: key,
      business_line: '压力测试线',
      degrade_reason: `第${i}次流程测试`,
      executor: '自动化测试'
    });
    
    if (createResult.status === 200 && createResult.body.success) {
      lastRecordId = createResult.body.data.id;
      
      const restoreResult = await apiCall('POST', `/restore/${lastRecordId}`, {
        applicant: '自动化测试'
      });
      
      if (restoreResult.status === 200 && restoreResult.body.success) {
        successfulRestores++;
        
        await apiCall('POST', '/cache-hit', {
          cache_key: key,
          value_type: 'string',
          is_null_cache: false
        });
      }
    }
  }

  logTest(
    '连续5次完整流程',
    '循环执行降级->恢复->命中->清理',
    { successfulRestores: 5 },
    { successfulRestores },
    successfulRestores === 5
  );

  console.log('\n测试3.6: 批量查询所有记录');
  const allRecords = await apiCall('GET', '/records?limit=100');
  logTest(
    '批量查询记录',
    { limit: 100 },
    { success: true, count: '>=10' },
    { success: allRecords.body.success, count: allRecords.body.data.length },
    allRecords.status === 200 && allRecords.body.success && allRecords.body.data.length >= 10
  );

  console.log('\n测试3.7: 多次命中同一Key的清理计数');
  const multiHitKey = 'multi:hit:test';
  const multiHitCreate = await apiCall('POST', '/degrade', {
    cache_key: multiHitKey,
    business_line: '测试线',
    degrade_reason: '多次命中测试',
    executor: '测试'
  });
  const multiHitRecordId = multiHitCreate.body.data?.id;
  await apiCall('POST', `/restore/${multiHitRecordId}`, { applicant: '测试' });

  for (let i = 0; i < 10; i++) {
    await apiCall('POST', '/cache-hit', {
      cache_key: multiHitKey,
      value_type: 'string',
      is_null_cache: false
    });
  }

  const tasksAfterHits = await apiCall('GET', '/cleanup-tasks');
  const multiHitTask = tasksAfterHits.body.data.find(t => t.cache_key === multiHitKey);
  
  logTest(
    '多次命中计数累加',
    { hits: 10 },
    { hitCount: 10 },
    { hitCount: multiHitTask?.hit_count },
    multiHitTask && multiHitTask.hit_count === 10
  );
}

async function saveTestResults() {
  const resultsDir = path.join(__dirname, '../test-results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const filename = `acceptance_test_${Date.now()}.json`;
  const filePath = path.join(resultsDir, filename);

  const summary = {
    totalTests: testResults.length,
    passedTests: testResults.filter(t => t.passed).length,
    failedTests: testResults.filter(t => !t.passed).length,
    passRate: ((testResults.filter(t => t.passed).length / testResults.length) * 100).toFixed(2) + '%',
    runTime: new Date().toISOString(),
    results: testResults
  };

  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2));
  
  console.log('\n========================================');
  console.log('测试摘要');
  console.log('========================================');
  console.log(`总测试数: ${summary.totalTests}`);
  console.log(`通过: ${summary.passedTests}`);
  console.log(`失败: ${summary.failedTests}`);
  console.log(`通过率: ${summary.passRate}`);
  console.log(`结果已保存: ${filePath}`);
  console.log('========================================\n');
}

async function main() {
  console.log('等待API服务启动...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await runNormalTests();
    await runExceptionTests();
    await runRepeatTests();
    await saveTestResults();
  } catch (error) {
    console.error('测试执行失败:', error.message);
    console.log(error.stack);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runNormalTests, runExceptionTests, runRepeatTests };