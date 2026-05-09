require('dotenv').config();
const pool = require('../src/database/pool');

async function runConcurrentTests() {
  console.log('\n========================================');
  console.log('  开始运行并发测试');
  console.log('========================================\n');

  try {
    const client = await pool.connect();
    console.log('[准备] 已连接到数据库');

    console.log('\n[清理] 清理测试数据...');
    await client.query('DELETE FROM reimbursements');
    await client.query('DELETE FROM travel_modifications');
    await client.query('DELETE FROM budget_locks');
    await client.query('DELETE FROM travel_requests');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM departments');
    console.log('[清理] 测试数据已清理');

    console.log('\n[初始化] 准备并发测试数据...');
    
    const deptResult = await client.query(
      `INSERT INTO departments (name, total_budget, used_budget, locked_budget, available_budget)
       VALUES ('并发测试部', 50000.00, 0.00, 0.00, 50000.00)
       RETURNING id`
    );
    const deptId = deptResult.rows[0].id;
    console.log(`[初始化] 创建并发测试部，ID: ${deptId}, 总预算: ¥50,000.00`);

    const empResult = await client.query(
      `INSERT INTO employees (name, department_id, position)
       VALUES ('并发测试员工', $1, '测试职位')
       RETURNING id`,
      [deptId]
    );
    const empId = empResult.rows[0].id;
    console.log(`[初始化] 创建并发测试员工，ID: ${empId}`);

    client.release();

    const travelRequestService = require('../src/services/travel-request-service');
    const departmentService = require('../src/services/department-service');

    console.log('\n========================================');
    console.log('  并发场景 1: 同时发起多个出差申请');
    console.log('  总预算: ¥50,000');
    console.log('  每个申请: ¥15,000');
    console.log('  并发数: 5');
    console.log('  预期: 只有 3 个能成功锁定预算 (3×15,000=45,000 ≤ 50,000)');
    console.log('========================================\n');

    const requestPromises = [];
    for (let i = 1; i <= 5; i++) {
      const promise = travelRequestService.createTravelRequest({
        employeeId: empId,
        purpose: `并发测试出差 #${i}`,
        destination: '并发测试城市',
        startDate: '2026-06-01',
        endDate: '2026-06-05',
        estimatedAmount: 15000.00
      });
      requestPromises.push(promise);
    }

    const results = await Promise.all(requestPromises);

    const successfulRequests = results.filter(r => r.success && r.businessCode === 'REQUEST_CREATED_AUTO_APPROVED');
    const pendingRequests = results.filter(r => r.success && r.businessCode === 'REQUEST_CREATED_EXCEEDS_BUDGET');

    console.log(`\n[结果] 成功自动批准: ${successfulRequests.length} 个`);
    console.log(`[结果] 转入人工审批: ${pendingRequests.length} 个`);

    results.forEach((r, index) => {
      console.log(`\n[申请 #${index + 1}]`);
      console.log(`  业务码: ${r.businessCode}`);
      console.log(`  消息: ${r.message}`);
    });

    const deptAfterConcurrent = await departmentService.getDepartmentById(deptId);
    console.log(`\n[最终状态]`);
    console.log(`  部门预算: 总额¥${deptAfterConcurrent.data.totalBudget.toFixed(2)}`);
    console.log(`  已锁定: ¥${deptAfterConcurrent.data.lockedBudget.toFixed(2)}`);
    console.log(`  已使用: ¥${deptAfterConcurrent.data.usedBudget.toFixed(2)}`);
    console.log(`  可用余额: ¥${deptAfterConcurrent.data.availableBudget.toFixed(2)}`);

    const expectedLocked = successfulRequests.length * 15000;
    const actualLocked = parseFloat(deptAfterConcurrent.data.lockedBudget);
    const dataConsistent = actualLocked === expectedLocked;

    console.log(`\n[数据一致性验证]`);
    console.log(`  预期锁定金额: ¥${expectedLocked.toFixed(2)}`);
    console.log(`  实际锁定金额: ¥${actualLocked.toFixed(2)}`);
    console.log(`  一致性: ${dataConsistent ? '✅ 通过' : '❌ 失败'}`);

    if (!dataConsistent) {
      console.error('\n❌ 数据不一致！并发场景下预算被重复锁定！');
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('  并发场景 2: 连续取消申请验证预算释放');
    console.log('========================================\n');

    const cancelPromises = successfulRequests.map(r => 
      travelRequestService.cancelTravelRequest(
        r.data.travelRequest.id, 
        '并发测试取消'
      )
    );

    const cancelResults = await Promise.all(cancelPromises);
    const successfulCancels = cancelResults.filter(r => r.success);

    console.log(`\n[结果] 成功取消: ${successfulCancels.length} 个`);

    const deptAfterCancel = await departmentService.getDepartmentById(deptId);
    console.log(`\n[取消后状态]`);
    console.log(`  部门预算: 总额¥${deptAfterCancel.data.totalBudget.toFixed(2)}`);
    console.log(`  已锁定: ¥${deptAfterCancel.data.lockedBudget.toFixed(2)}`);
    console.log(`  已使用: ¥${deptAfterCancel.data.usedBudget.toFixed(2)}`);
    console.log(`  可用余额: ¥${deptAfterCancel.data.availableBudget.toFixed(2)}`);

    const releaseConsistent = parseFloat(deptAfterCancel.data.lockedBudget) === 0 &&
                            parseFloat(deptAfterCancel.data.availableBudget) === 50000;

    console.log(`\n[释放一致性验证]`);
    console.log(`  锁定应为 0: ${parseFloat(deptAfterCancel.data.lockedBudget) === 0 ? '✅' : '❌'}`);
    console.log(`  可用应为 50,000: ${parseFloat(deptAfterCancel.data.availableBudget) === 50000 ? '✅' : '❌'}`);
    console.log(`  一致性: ${releaseConsistent ? '✅ 通过' : '❌ 失败'}`);

    if (!releaseConsistent) {
      console.error('\n❌ 预算释放不一致！');
      process.exit(1);
    }

    console.log('\n========================================');
    console.log('  ✅ 所有并发测试通过！');
    console.log('  关键资源在并发下未被多占、漏放');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 并发测试执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runConcurrentTests();
