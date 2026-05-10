const http = require('http');
const path = require('path');
const fs = require('fs');

// 确保测试数据目录存在
const testDataDir = path.join(__dirname, '../test-data');
if (!fs.existsSync(testDataDir)) {
  fs.mkdirSync(testDataDir, { recursive: true });
}

const BASE_URL = 'http://localhost:3000';
const TEST_RESULTS = [];

function logTestResult(testName, passed, message = '') {
  const result = {
    testName,
    passed,
    message,
    timestamp: new Date().toISOString()
  };
  TEST_RESULTS.push(result);
  
  const status = passed ? '✓ 通过' : '✗ 失败';
  console.log(`${status} - ${testName}`);
  if (message) {
    console.log(`  ${message}`);
  }
  console.log('');
}

function makeRequest(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedData
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(retries = 30, interval = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await makeRequest('GET', `${BASE_URL}/api/admin/status`);
      if (response.statusCode === 200) {
        return true;
      }
    } catch (e) {
      // 忽略错误，继续重试
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('服务器启动超时');
}

async function runTests() {
  console.log('\n========================================');
  console.log('  工单 SLA 暂停恢复 API 系统 - 测试');
  console.log('========================================\n');

  let testTicketId = null;

  try {
    // 等待服务器启动
    console.log('等待服务器启动...\n');
    await waitForServer();

    // 测试 1: 创建工单
    console.log('--- 主流程测试 ---\n');
    
    const createResponse = await makeRequest('POST', `${BASE_URL}/api/tickets`, {
      title: '测试工单 - 用户需要补充材料',
      customerId: 'CUST001',
      priority: 'normal',
      assigneeId: 'AGENT001'
    });

    if (createResponse.statusCode === 201 && createResponse.body.success) {
      logTestResult('创建工单成功', true, `工单ID: ${createResponse.body.ticketId}`);
      testTicketId = createResponse.body.ticketId;
    } else {
      logTestResult('创建工单成功', false, `状态码: ${createResponse.statusCode}`);
      return;
    }

    // 测试 2: 获取工单详情
    const getResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}`);
    logTestResult(
      '获取工单详情成功',
      getResponse.statusCode === 200 && getResponse.body.id === testTicketId,
      `状态: ${getResponse.body.status}`
    );

    // 测试 3: 暂停 SLA (等待用户补充材料场景)
    const pauseResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/pause`, {
      reason: 'user_awaiting',
      pausedBy: 'AGENT001',
      notes: '等待用户提供身份证复印件'
    });
    logTestResult(
      '暂停 SLA 成功',
      pauseResponse.statusCode === 200 && pauseResponse.body.success,
      `暂停ID: ${pauseResponse.body.pauseId}`
    );

    // 测试 4: 验证暂停后工单状态
    const afterPauseResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}`);
    logTestResult(
      '暂停后工单状态为 awaiting_user',
      afterPauseResponse.statusCode === 200 && afterPauseResponse.body.status === 'awaiting_user',
      `实际状态: ${afterPauseResponse.body.status}`
    );

    // 测试 5: 冲突检测 - 重复暂停
    console.log('--- 异常处理测试 ---\n');
    
    const duplicatePauseResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/pause`, {
      reason: 'user_awaiting',
      pausedBy: 'AGENT001'
    });
    logTestResult(
      '重复暂停应该失败',
      duplicatePauseResponse.statusCode === 400,
      `错误信息: ${duplicatePauseResponse.body.error}`
    );

    // 测试 6: 撤销暂停
    const cancelResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/cancel-pause`, {
      cancelledBy: 'AGENT001',
      reason: '用户已通过其他渠道提供材料'
    });
    logTestResult(
      '撤销暂停成功',
      cancelResponse.statusCode === 200 && cancelResponse.body.success,
      cancelResponse.body.message
    );

    // 测试 7: 验证撤销后工单状态恢复
    const afterCancelResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}`);
    logTestResult(
      '撤销后工单状态恢复为 in_progress',
      afterCancelResponse.statusCode === 200 && afterCancelResponse.body.status === 'in_progress',
      `实际状态: ${afterCancelResponse.body.status}`
    );

    // 测试 8: 验证撤销的暂停不计入时长
    const pauseHistoryResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}/pause-history`);
    const cancelledPause = pauseHistoryResponse.body.find(p => p.status === 'cancelled');
    logTestResult(
      '撤销的暂停状态为 cancelled',
      pauseHistoryResponse.statusCode === 200 && cancelledPause,
      `暂停历史数量: ${pauseHistoryResponse.body.length}`
    );

    // 测试 9: 重新暂停后正常恢复
    await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/pause`, {
      reason: 'user_awaiting',
      pausedBy: 'AGENT001',
      notes: '再次等待用户补充材料'
    });

    // 等待一小段时间模拟实际暂停
    await new Promise(resolve => setTimeout(resolve, 100));

    const resumeResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/resume`, {
      resumedBy: 'AGENT001',
      notes: '用户已提供所有材料'
    });
    logTestResult(
      '恢复 SLA 成功',
      resumeResponse.statusCode === 200 && resumeResponse.body.success,
      `新截止时间: ${resumeResponse.body.newDeadline}`
    );

    // 测试 10: 验证恢复后截止时间正确更新
    const afterResumeResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}`);
    logTestResult(
      '恢复后工单状态为 in_progress',
      afterResumeResponse.statusCode === 200 && afterResumeResponse.body.status === 'in_progress',
      `实际状态: ${afterResumeResponse.body.status}`
    );

    // 测试 11: 已恢复的工单不能再次恢复
    const duplicateResumeResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/resume`, {
      resumedBy: 'AGENT001'
    });
    logTestResult(
      '已恢复的工单不能再次恢复',
      duplicateResumeResponse.statusCode === 400,
      `错误信息: ${duplicateResumeResponse.body.error}`
    );

    // 测试 12: 数据一致性 - 暂停历史记录
    const finalHistoryResponse = await makeRequest('GET', `${BASE_URL}/api/tickets/${testTicketId}/pause-history`);
    logTestResult(
      '暂停历史记录完整',
      finalHistoryResponse.statusCode === 200 && finalHistoryResponse.body.length >= 2,
      `历史记录数: ${finalHistoryResponse.body.length}`
    );

    // 测试 13: 关闭工单
    console.log('--- 数据一致性测试 ---\n');
    
    const closeResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/close`, {
      closedBy: 'AGENT001'
    });
    logTestResult(
      '关闭工单成功',
      closeResponse.statusCode === 200 && closeResponse.body.success,
      closeResponse.body.message
    );

    // 测试 14: 已关闭工单不能暂停
    const closedTicketPauseResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${testTicketId}/pause`, {
      reason: 'user_awaiting',
      pausedBy: 'AGENT001'
    });
    logTestResult(
      '已关闭工单不能暂停',
      closedTicketPauseResponse.statusCode === 400,
      `错误信息: ${closedTicketPauseResponse.body.error}`
    );

    // 测试 15: 无效暂停原因
    const invalidReasonResponse = await makeRequest('POST', `${BASE_URL}/api/tickets`, {
      title: '测试无效原因工单',
      customerId: 'CUST002',
      priority: 'normal'
    });
    
    if (invalidReasonResponse.statusCode === 201) {
      const invalidTicketId = invalidReasonResponse.body.ticketId;
      const invalidPauseResponse = await makeRequest('POST', `${BASE_URL}/api/tickets/${invalidTicketId}/pause`, {
        reason: 'invalid_reason',
        pausedBy: 'AGENT001'
      });
      logTestResult(
        '无效暂停原因应该失败',
        invalidPauseResponse.statusCode === 400,
        `错误信息: ${invalidPauseResponse.body.error}`
      );
    }

    // 测试 16: 报表生成
    console.log('--- 报表功能测试 ---\n');
    
    const reportResponse = await makeRequest('GET', `${BASE_URL}/api/admin/reports`);
    logTestResult(
      '报表生成成功',
      reportResponse.statusCode === 200 && reportResponse.body.summary,
      `总工单数: ${reportResponse.body.summary.totalTickets}`
    );

    // 测试 17: 系统状态
    const statusResponse = await makeRequest('GET', `${BASE_URL}/api/admin/status`);
    logTestResult(
      '系统状态正常',
      statusResponse.statusCode === 200 && statusResponse.body.status === 'running',
      `版本: ${statusResponse.body.version}`
    );

    console.log('\n========================================');
    console.log('  测试结果汇总');
    console.log('========================================\n');

    const passed = TEST_RESULTS.filter(r => r.passed).length;
    const failed = TEST_RESULTS.filter(r => !r.passed).length;
    const total = TEST_RESULTS.length;

    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`\n通过率: ${((passed / total) * 100).toFixed(2)}%\n`);

    if (failed > 0) {
      console.log('失败的测试:');
      TEST_RESULTS.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.testName}`);
      });
    }

    // 输出验收点
    console.log('\n========================================');
    console.log('  自然语言验收点');
    console.log('========================================\n');
    console.log('【主流程验收】');
    console.log('1. 创建工单时，系统应根据优先级自动计算 SLA 截止时间');
    console.log('2. 客服执行「暂停 SLA」操作后，工单状态应变为 awaiting_user');
    console.log('3. 暂停期间，SLA 计时应停止，截止时间不应倒计时');
    console.log('4. 用户补充材料后，客服执行「恢复 SLA」操作，计时应从暂停点继续');
    console.log('5. 恢复后，系统应重新计算并更新 SLA 截止时间');
    console.log('');
    console.log('【异常处理验收】');
    console.log('6. 对已暂停的工单再次执行暂停，系统应返回错误提示');
    console.log('7. 对未暂停的工单执行恢复，系统应返回错误提示');
    console.log('8. 撤销暂停后，该暂停时长不应计入总暂停时间');
    console.log('9. 已关闭/已解决的工单不能再执行暂停操作');
    console.log('10. 关闭工单前必须先恢复或撤销所有活跃的暂停');
    console.log('');
    console.log('【数据一致性验收】');
    console.log('11. 每次暂停/恢复/撤销操作都应记录完整的操作历史');
    console.log('12. 暂停历史应包含：操作人、时间、原因、备注、状态');
    console.log('13. 多次暂停恢复后，总暂停时长应等于各次有效暂停时长之和');
    console.log('14. 工单详情中应能查看完整的暂停历史记录');
    console.log('15. 客服报表应能正确统计：暂停次数、平均暂停时长、超时数量');
    console.log('');
    console.log('【超时升级验收】');
    console.log('16. 未暂停的工单超过 SLA 截止时间时应触发升级');
    console.log('17. 已暂停的工单即使超过原截止时间也不应触发升级');
    console.log('18. 同一工单不应重复触发升级');
    console.log('');

  } catch (error) {
    console.error('\n测试执行出错:', error);
    process.exit(1);
  }
}

runTests();
