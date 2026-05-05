const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
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

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function getTool(toolId) {
  const result = await makeRequest(`/api/tools/${toolId}`);
  return result.data;
}

async function performAction(toolId, userId, action) {
  const result = await makeRequest(`/api/tools/${toolId}/action`, {
    method: 'POST',
    body: { action, userId }
  });
  return result;
}

async function testConcurrentReservation() {
  console.log('\n========================================');
  console.log('测试1: 并发预约同一件工具');
  console.log('========================================\n');

  const toolId = 1;
  const user1Id = 1;
  const user2Id = 2;

  const initialTool = await getTool(toolId);
  console.log(`初始状态: ${initialTool.data.name} - ${initialTool.data.status}`);

  console.log('\n同时发送两个预约请求...\n');

  const promises = [
    performAction(toolId, user1Id, 'RESERVE'),
    performAction(toolId, user2Id, 'RESERVE')
  ];

  const results = await Promise.all(promises);

  results.forEach((result, index) => {
    console.log(`请求 ${index + 1} (用户${index + 1}):`);
    console.log(`  状态码: ${result.status}`);
    console.log(`  成功: ${result.data.success}`);
    console.log(`  消息: ${result.data.error || result.data.message || '-'}`);
    console.log();
  });

  const successCount = results.filter(r => r.data.success).length;
  const failCount = results.filter(r => !r.data.success).length;

  console.log(`结果: ${successCount} 个成功, ${failCount} 个失败`);
  console.log(`预期: 只有 1 个成功，其他因状态冲突而失败`);
  console.log(`测试结果: ${successCount === 1 && failCount === 1 ? 'PASS' : 'FAIL'}`);

  const finalTool = await getTool(toolId);
  console.log(`\n最终状态: ${finalTool.data.name} - ${finalTool.data.status}`);

  if (finalTool.data.status === 'RESERVED') {
    await performAction(toolId, finalTool.data.reservation.user_id, 'CANCEL_RESERVATION');
    console.log('已清理：取消预约');
  }
}

async function testRapidClicks() {
  console.log('\n========================================');
  console.log('测试2: 快速重复点击（模拟用户双击）');
  console.log('========================================\n');

  const toolId = 2;
  const userId = 1;

  const initialTool = await getTool(toolId);
  console.log(`初始状态: ${initialTool.data.name} - ${initialTool.data.status}`);

  console.log('\n快速发送 5 个预约请求...\n');

  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(performAction(toolId, userId, 'RESERVE'));
  }

  const results = await Promise.all(promises);

  results.forEach((result, index) => {
    console.log(`请求 ${index + 1}:`);
    console.log(`  成功: ${result.data.success}`);
    console.log(`  消息: ${result.data.error || result.data.message || '-'}`);
    console.log();
  });

  const successCount = results.filter(r => r.data.success).length;
  const failCount = results.filter(r => !r.data.success).length;

  console.log(`结果: ${successCount} 个成功, ${failCount} 个失败`);
  console.log(`预期: 只有 1 个成功，其他因状态冲突而失败`);
  console.log(`测试结果: ${successCount === 1 ? 'PASS' : 'FAIL'}`);

  const finalTool = await getTool(toolId);
  console.log(`\n最终状态: ${finalTool.data.name} - ${finalTool.data.status}`);

  if (finalTool.data.status === 'RESERVED') {
    await performAction(toolId, userId, 'CANCEL_RESERVATION');
    console.log('已清理：取消预约');
  }
}

async function testStateMachineValidation() {
  console.log('\n========================================');
  console.log('测试3: 状态机校验（非法状态跳转）');
  console.log('========================================\n');

  const toolId = 3;
  const userId = 1;

  let tool = await getTool(toolId);
  console.log(`初始状态: ${tool.data.name} - ${tool.data.status}`);

  console.log('\n测试1: 从 AVAILABLE 尝试直接 BORROW（应该失败）');
  let result = await performAction(toolId, userId, 'BORROW');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 失败，需要先预约`);
  console.log(`  测试结果: ${!result.data.success ? 'PASS' : 'FAIL'}\n`);

  console.log('测试2: 从 AVAILABLE RESERVE（应该成功）');
  result = await performAction(toolId, userId, 'RESERVE');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 成功`);
  console.log(`  测试结果: ${result.data.success ? 'PASS' : 'FAIL'}\n`);

  tool = await getTool(toolId);
  console.log(`当前状态: ${tool.data.status}`);

  console.log('测试3: 从 RESERVED 尝试再次 RESERVE（应该失败）');
  result = await performAction(toolId, userId, 'RESERVE');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 失败，已被预约`);
  console.log(`  测试结果: ${!result.data.success ? 'PASS' : 'FAIL'}\n`);

  console.log('测试4: 从 RESERVED BORROW（应该成功）');
  result = await performAction(toolId, userId, 'BORROW');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 成功`);
  console.log(`  测试结果: ${result.data.success ? 'PASS' : 'FAIL'}\n`);

  tool = await getTool(toolId);
  console.log(`当前状态: ${tool.data.status}`);

  console.log('测试5: 从 BORROWED 尝试 RESERVE（应该失败）');
  result = await performAction(toolId, userId, 'RESERVE');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 失败，已被借出`);
  console.log(`  测试结果: ${!result.data.success ? 'PASS' : 'FAIL'}\n`);

  console.log('测试6: 从 BORROWED RETURN（应该成功）');
  result = await performAction(toolId, userId, 'RETURN');
  console.log(`  成功: ${result.data.success}`);
  console.log(`  消息: ${result.data.error || result.data.message}`);
  console.log(`  预期: 成功`);
  console.log(`  测试结果: ${result.data.success ? 'PASS' : 'FAIL'}\n`);

  tool = await getTool(toolId);
  console.log(`最终状态: ${tool.data.status}`);
  console.log(`已清理：工具已归还`);
}

async function testTwoUsersConflict() {
  console.log('\n========================================');
  console.log('测试4: 两个用户操作同一件工具（模拟两个浏览器）');
  console.log('========================================\n');

  const toolId = 4;
  const userA = 1;
  const userB = 2;

  let tool = await getTool(toolId);
  console.log(`初始状态: ${tool.data.name} - ${tool.data.status}`);

  console.log('\n用户A 预约工具...');
  let resultA = await performAction(toolId, userA, 'RESERVE');
  console.log(`  用户A 结果: ${resultA.data.success ? '成功' : '失败'} - ${resultA.data.message || resultA.data.error}`);

  tool = await getTool(toolId);
  console.log(`当前状态: ${tool.data.status}, 预约人: ${tool.data.reservation?.user_name || '无'}`);

  console.log('\n用户B 尝试预约同一工具...');
  let resultB = await performAction(toolId, userB, 'RESERVE');
  console.log(`  用户B 结果: ${resultB.data.success ? '成功' : '失败'} - ${resultB.data.message || resultB.data.error}`);

  console.log('\n测试场景：用户A已预约，用户B尝试借出');
  console.log('用户B 尝试借出...');
  resultB = await performAction(toolId, userB, 'BORROW');
  console.log(`  用户B 结果: ${resultB.data.success ? '成功' : '失败'} - ${resultB.data.message || resultB.data.error}`);
  console.log(`  预期: 失败，只能借出自己预约的工具`);
  console.log(`  测试结果: ${!resultB.data.success ? 'PASS' : 'FAIL'}\n`);

  console.log('用户A 借出工具...');
  resultA = await performAction(toolId, userA, 'BORROW');
  console.log(`  用户A 结果: ${resultA.data.success ? '成功' : '失败'} - ${resultA.data.message || resultA.data.error}`);

  tool = await getTool(toolId);
  console.log(`当前状态: ${tool.data.status}, 借用人: ${tool.data.borrow?.user_name || '无'}`);

  console.log('\n用户B 尝试归还工具...');
  resultB = await performAction(toolId, userB, 'RETURN');
  console.log(`  用户B 结果: ${resultB.data.success ? '成功' : '失败'} - ${resultB.data.message || resultB.data.error}`);
  console.log(`  说明: 任何人都可以归还工具（实际场景中可能需要更严格的权限控制）\n`);

  console.log('用户A 归还工具...');
  resultA = await performAction(toolId, userA, 'RETURN');
  console.log(`  用户A 结果: ${resultA.data.success ? '成功' : '失败'} - ${resultA.data.message || resultA.data.error}`);

  tool = await getTool(toolId);
  console.log(`最终状态: ${tool.data.status}`);
}

async function main() {
  console.log('社区共享工具柜 - 并发测试脚本');
  console.log('========================================');
  console.log('请确保服务已启动: npm start');
  console.log('========================================\n');

  try {
    await testConcurrentReservation();
    await testRapidClicks();
    await testStateMachineValidation();
    await testTwoUsersConflict();

    console.log('\n========================================');
    console.log('所有测试完成！');
    console.log('========================================');
    console.log('\n测试说明:');
    console.log('1. 并发预约测试验证了乐观锁机制 - 只有第一个请求能成功');
    console.log('2. 快速点击测试验证了重复提交保护');
    console.log('3. 状态机测试验证了非法状态跳转会被拒绝');
    console.log('4. 多用户冲突测试模拟了两个浏览器同时操作的场景');
    console.log('\n查看操作日志: GET /api/logs');
  } catch (error) {
    console.error('测试失败:', error.message);
    console.log('\n请确保服务已启动: npm start');
    console.log('服务地址: http://localhost:3000');
    process.exit(1);
  }
}

main();
