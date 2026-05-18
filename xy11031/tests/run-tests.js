const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('========================================');
console.log('家电安装队安装师傅抢单API - 自动化测试');
console.log('========================================\n');

const BASE_URL = 'http://localhost:3001/api';

function request(url, options = {}) {
  const cmd = `curl -s -X ${options.method || 'GET'} "${BASE_URL}${url}" ${
    options.headers ? `-H "${options.headers}"` : ''
  } ${options.body ? `-d '${options.body}'` : ''}`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function printResult(testName, success, message = '') {
  const status = success ? '✓ 通过' : '✗ 失败';
  console.log(`${status} - ${testName}`);
  if (message) {
    console.log(`  ${message}`);
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('1. 健康检查测试');
  console.log('----------------------------------------');
  const healthResult = request('/health');
  if (healthResult.success) {
    printResult('健康检查', true);
    passed++;
  } else {
    printResult('健康检查', false, healthResult.error);
    failed++;
  }
  console.log('');

  console.log('2. 清空已有数据（测试环境）');
  console.log('----------------------------------------');
  const dataDir = path.join(__dirname, '..', 'data');
  const ordersFile = path.join(dataDir, 'orders.json');
  const batchesFile = path.join(dataDir, 'batches.json');
  if (fs.existsSync(ordersFile)) fs.unlinkSync(ordersFile);
  if (fs.existsSync(batchesFile)) fs.unlinkSync(batchesFile);
  printResult('清空测试数据', true);
  passed++;
  console.log('');

  console.log('3. 导入正常订单数据');
  console.log('----------------------------------------');
  const sampleData = fs.readFileSync(path.join(__dirname, '..', 'data', 'sample_orders.json'), 'utf8');
  const importResult = request('/import/json', {
    method: 'POST',
    headers: 'Content-Type: application/json',
    body: sampleData
  });
  if (importResult.success && importResult.data.summary.total === 5) {
    printResult('导入5条订单', true, `成功: ${importResult.data.summary.success}, 待审核: ${importResult.data.summary.needsReview}, 失败: ${importResult.data.summary.failed}`);
    passed++;
  } else {
    printResult('导入5条订单', false, JSON.stringify(importResult));
    failed++;
  }
  console.log('');

  console.log('4. 导入边界测试数据（重复、时段重叠、缺字段）');
  console.log('----------------------------------------');
  const boundaryData = fs.readFileSync(path.join(__dirname, '..', 'data', 'boundary_test_orders.json'), 'utf8');
  const boundaryResult = request('/import/json', {
    method: 'POST',
    headers: 'Content-Type: application/json',
    body: boundaryData
  });
  if (boundaryResult.success) {
    const { success: successCount, failed, needsReview } = boundaryResult.data.summary;
    let allChecksPassed = true;
    
    if (failed < 1) {
      printResult('缺字段订单应该被识别为失败', false, `失败数: ${failed}, 期望至少1条`);
      allChecksPassed = false;
      failed++;
    }
    
    if (needsReview < 2) {
      printResult('重复订单和时段重叠订单应该进入待审核', false, `待审核: ${needsReview}, 期望至少2条`);
      allChecksPassed = false;
      failed++;
    }
    
    if (allChecksPassed) {
      printResult('边界数据导入验证', true, `成功: ${successCount}, 失败: ${failed}, 待审核: ${needsReview}`);
      passed++;
      
      if (boundaryResult.data.failedRows.length > 0) {
        console.log('  坏行示例（带原始数据和原因）:');
        const badRow = boundaryResult.data.failedRows[0];
        console.log(`    - 原始数据: ${JSON.stringify(badRow.originalData).substring(0, 100)}...`);
        console.log(`    - 失败原因: ${badRow.reason}`);
        console.log(`    - 处理建议: ${badRow.suggestion}`);
      }
    }
  }
  console.log('');

  console.log('5. 查看待人工审核订单');
  console.log('----------------------------------------');
  const pendingReview = request('/import/review/pending');
  if (pendingReview.success && pendingReview.data.length > 0) {
    printResult('待审核订单列表获取', true, `待审核数量: ${pendingReview.data.length}`);
    passed++;
    
    const firstOrder = pendingReview.data[0];
    console.log(`  示例订单问题:`);
    firstOrder.issues.forEach((issue, idx) => {
      console.log(`    ${idx + 1}. 类型: ${issue.type}`);
      console.log(`       原因: ${issue.reason}`);
      console.log(`       建议: ${issue.suggestion}`);
    });
  } else {
    printResult('待审核订单列表获取', false, '没有找到待审核订单');
    failed++;
  }
  console.log('');

  console.log('6. 人工审核处理（通过）');
  console.log('----------------------------------------');
  if (pendingReview.success && pendingReview.data.length > 0) {
    const orderId = pendingReview.data[0].id;
    const reviewResult = request(`/import/review/${orderId}`, {
      method: 'POST',
      headers: 'Content-Type: application/json',
      body: JSON.stringify({
        action: 'approve',
        remark: '经核实，该时段重叠为特殊情况，客户坚持要求今日安装，已电话沟通确认',
        operator: '张经理'
      })
    });
    if (reviewResult.success) {
      printResult('人工审核通过', true, `备注已保存: ${reviewResult.data.manualRemarks.length}条`);
      passed++;
      console.log(`  审核备注: ${reviewResult.data.manualRemarks[0].content}`);
      console.log(`  操作人: ${reviewResult.data.manualRemarks[0].operator}`);
    } else {
      printResult('人工审核通过', false, reviewResult.error);
      failed++;
    }
  }
  console.log('');

  console.log('7. 状态越级变更测试（应失败）');
  console.log('----------------------------------------');
  const allOrders = request('/import/orders');
  if (allOrders.success && allOrders.data.length > 0) {
    const orderId = allOrders.data[0].id;
    const statusResult = request(`/import/orders/${orderId}/status`, {
      method: 'PUT',
      headers: 'Content-Type: application/json',
      body: JSON.stringify({ status: 'completed' })
    });
    if (!statusResult.success) {
      printResult('状态越级变更拦截', true, `拦截原因: ${statusResult.error}`);
      passed++;
      console.log(`  处理建议: ${statusResult.suggestion}`);
    } else {
      printResult('状态越级变更拦截', false, '应该被拦截但实际通过了');
      failed++;
    }
  }
  console.log('');

  console.log('8. 正常状态流转测试');
  console.log('----------------------------------------');
  if (allOrders.success && allOrders.data.length > 0) {
    const pendingOrder = allOrders.data.find(o => o.status === 'pending');
    if (pendingOrder) {
      const normalStatusResult = request(`/import/orders/${pendingOrder.id}/status`, {
        method: 'PUT',
        headers: 'Content-Type: application/json',
        body: JSON.stringify({ status: 'locked' })
      });
      if (normalStatusResult.success) {
        printResult('正常状态流转(pending->locked)', true, `新状态: ${normalStatusResult.data.status}`);
        passed++;
      } else {
        printResult('正常状态流转(pending->locked)', false, normalStatusResult.error);
        failed++;
      }
    } else {
      printResult('正常状态流转(pending->locked)', false, '没有找到pending状态的订单');
      failed++;
    }
  }
  console.log('');

  console.log('========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`通过: ${passed} 项`);
  console.log(`失败: ${failed} 项`);
  console.log(`总计: ${passed + failed} 项`);
  console.log('');
  console.log(failed === 0 ? '✓ 所有测试通过！' : '✗ 存在测试失败，请检查！');
  console.log('');
}

runTests().catch(console.error);
