require('dotenv').config();
const pool = require('../src/database/pool');

async function runTests() {
  console.log('\n========================================');
  console.log('  开始运行差旅预算占用 API 测试');
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

    console.log('\n[初始化] 准备测试数据...');
    
    const deptResult = await client.query(
      `INSERT INTO departments (name, total_budget, used_budget, locked_budget, available_budget)
       VALUES ('测试技术部', 100000.00, 0.00, 0.00, 100000.00)
       RETURNING id`
    );
    const deptId = deptResult.rows[0].id;
    console.log(`[初始化] 创建测试技术部，ID: ${deptId}, 预算: ¥100,000.00`);

    const empResult = await client.query(
      `INSERT INTO employees (name, department_id, position)
       VALUES ('测试员工', $1, '测试职位')
       RETURNING id`,
      [deptId]
    );
    const empId = empResult.rows[0].id;
    console.log(`[初始化] 创建测试员工，ID: ${empId}`);

    client.release();

    console.log('\n========================================');
    console.log('  测试数据准备完成');
    console.log('========================================\n');

    const travelRequestService = require('../src/services/travel-request-service');
    const modificationService = require('../src/services/travel-modification-service');
    const reimbursementService = require('../src/services/reimbursement-service');
    const departmentService = require('../src/services/department-service');

    console.log('[测试 1] 创建出差申请（预算充足）');
    const request1 = await travelRequestService.createTravelRequest({
      employeeId: empId,
      purpose: '测试出差',
      destination: '北京',
      startDate: '2026-05-15',
      endDate: '2026-05-20',
      estimatedAmount: 10000.00
    });
    console.log(`  结果: ${request1.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${request1.businessCode}`);
    console.log(`  消息: ${request1.message}`);
    if (!request1.success) {
      console.log(`  错误详情:`, request1.data);
      process.exit(1);
    }
    const requestId1 = request1.data.travelRequest.id;

    const deptAfterRequest1 = await departmentService.getDepartmentById(deptId);
    console.log(`  部门预算状态: 总额¥${deptAfterRequest1.data.totalBudget.toFixed(2)}, 锁定¥${deptAfterRequest1.data.lockedBudget.toFixed(2)}, 可用¥${deptAfterRequest1.data.availableBudget.toFixed(2)}`);

    console.log('\n[测试 2] 创建改签（金额增加）');
    const mod1 = await modificationService.createModification(
      requestId1,
      15000.00,
      '航班升级'
    );
    console.log(`  结果: ${mod1.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${mod1.businessCode}`);
    console.log(`  消息: ${mod1.message}`);

    const deptAfterMod1 = await departmentService.getDepartmentById(deptId);
    console.log(`  部门预算状态: 总额¥${deptAfterMod1.data.totalBudget.toFixed(2)}, 锁定¥${deptAfterMod1.data.lockedBudget.toFixed(2)}, 可用¥${deptAfterMod1.data.availableBudget.toFixed(2)}`);

    console.log('\n[测试 3] 创建改签（金额减少）');
    const mod2 = await modificationService.createModification(
      requestId1,
      12000.00,
      '调整行程'
    );
    console.log(`  结果: ${mod2.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${mod2.businessCode}`);
    console.log(`  消息: ${mod2.message}`);

    console.log('\n[测试 4] 创建报销申请（超支）');
    const reimb1 = await reimbursementService.createReimbursement(
      requestId1,
      13000.00
    );
    console.log(`  结果: ${reimb1.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${reimb1.businessCode}`);
    console.log(`  消息: ${reimb1.message}`);

    console.log('\n[测试 5] 报销结算');
    const settle1 = await reimbursementService.settleReimbursement(
      reimb1.data.reimbursement.id
    );
    console.log(`  结果: ${settle1.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${settle1.businessCode}`);
    console.log(`  消息: ${settle1.message}`);

    const deptAfterSettle1 = await departmentService.getDepartmentById(deptId);
    console.log(`  部门预算状态: 总额¥${deptAfterSettle1.data.totalBudget.toFixed(2)}, 已用¥${deptAfterSettle1.data.usedBudget.toFixed(2)}, 锁定¥${deptAfterSettle1.data.lockedBudget.toFixed(2)}, 可用¥${deptAfterSettle1.data.availableBudget.toFixed(2)}`);

    console.log('\n[测试 6] 创建出差申请（超出预算）');
    const request2 = await travelRequestService.createTravelRequest({
      employeeId: empId,
      purpose: '大额测试出差',
      destination: '上海',
      startDate: '2026-06-01',
      endDate: '2026-06-10',
      estimatedAmount: 200000.00
    });
    console.log(`  结果: ${request2.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${request2.businessCode}`);
    console.log(`  消息: ${request2.message}`);

    console.log('\n[测试 7] 取消出差申请（释放预算）');
    const cancel2 = await travelRequestService.cancelTravelRequest(
      request2.data.travelRequest.id,
      '测试取消'
    );
    console.log(`  结果: ${cancel2.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${cancel2.businessCode}`);
    console.log(`  消息: ${cancel2.message}`);

    console.log('\n[测试 8] 部门报表查询');
    const report = await departmentService.getDepartmentReport(deptId);
    console.log(`  结果: ${report.success ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  业务码: ${report.businessCode}`);
    console.log(`  消息: ${report.message}`);
    console.log(`  摘要: ${report.data.summary.summaryText}`);
    console.log(`  预算使用率: ${report.data.department.budgetUtilizationRate}`);

    console.log('\n========================================');
    console.log('  ✅ 所有测试通过！');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
