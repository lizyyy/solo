const db = require('../src/config/database');
const detourService = require('../src/services/detourService');
const baseDataService = require('../src/services/baseDataService');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  console.log(`\n${colors.blue}▶${colors.reset} 测试: ${name}`);
  try {
    await fn();
    console.log(`  ${colors.green}✓ 通过${colors.reset}`);
    passed++;
  } catch (error) {
    console.log(`  ${colors.red}✗ 失败: ${error.message}${colors.reset}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

async function runTests() {
  console.log(`${colors.blue}══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}     校车临时改线API - 自检测试脚本${colors.reset}`);
  console.log(`${colors.blue}══════════════════════════════════════════════════════${colors.reset}`);

  try {
    db.exec('SELECT 1');
    console.log(`\n${colors.green}✓ 数据库连接正常${colors.reset}`);
  } catch (error) {
    console.log(`\n${colors.red}✗ 数据库连接失败: ${error.message}${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.yellow}--- 阶段1: 基础数据测试 ---${colors.reset}`);

  await test('获取线路列表', () => {
    const routes = baseDataService.getRoutes();
    assert(Array.isArray(routes), '应返回数组');
    assert(routes.length >= 0, '数组长度应合法');
  });

  await test('获取站点列表', () => {
    const stops = baseDataService.getStops();
    assert(Array.isArray(stops), '应返回数组');
  });

  await test('获取学生列表', () => {
    const students = baseDataService.getStudents();
    assert(Array.isArray(students), '应返回数组');
  });

  await test('获取改线原因列表', () => {
    const reasons = baseDataService.getDetourReasons();
    assert(Array.isArray(reasons), '应返回数组');
  });

  console.log(`\n${colors.yellow}--- 阶段2: 正常流程测试 ---${colors.reset}`);

  let testPlanId = null;
  let testRouteId = null;
  let testReasonId = null;
  let testStopId1 = null;
  let testStopId2 = null;
  let testStudentId = null;

  await test('准备测试数据 - 获取一条线路', () => {
    const routes = baseDataService.getRoutes();
    if (routes.length > 0) {
      testRouteId = routes[0].id;
    }
  });

  await test('准备测试数据 - 获取改线原因', () => {
    const reasons = baseDataService.getDetourReasons();
    if (reasons.length > 0) {
      testReasonId = reasons[0].id;
    }
  });

  await test('准备测试数据 - 获取站点', () => {
    const stops = baseDataService.getStops();
    if (stops.length >= 2) {
      testStopId1 = stops[0].id;
      testStopId2 = stops[1].id;
    }
  });

  await test('准备测试数据 - 获取学生', () => {
    const students = baseDataService.getStudents();
    if (students.length > 0) {
      testStudentId = students[0].id;
    }
  });

  await test('创建改线计划', async () => {
    const plan = await detourService.createDetourPlan({
      route_id: testRouteId,
      reason_id: testReasonId,
      plan_date: '2024-05-20',
      start_time: '07:00',
      end_time: '09:00',
      estimated_delay: 30,
      operator: '管理员',
      remark: '道路施工改道',
      stop_replacements: testStopId1 && testStopId2 ? [{
        original_stop_id: testStopId1,
        temp_stop_id: testStopId2,
        new_arrival_time: '07:30'
      }] : []
    });
    assert(plan, '改线计划应创建成功');
    assert(plan.id, '应有ID');
    assert(plan.status === 'draft', '初始状态应为draft');
    testPlanId = plan.id;
  });

  await test('查询改线计划详情', () => {
    const plan = detourService.getDetourPlanById(testPlanId);
    assert(plan, '应能查询到计划');
    assert(plan.id === testPlanId, 'ID应匹配');
  });

  await test('查询改线计划列表', () => {
    const plans = detourService.listDetourPlans();
    assert(Array.isArray(plans), '应返回数组');
    assert(plans.length > 0, '应有至少一条记录');
  });

  await test('状态转换 - draft -> pending', () => {
    const plan = detourService.transitionStatus(testPlanId, 'pending', '操作员', '提交审核');
    assert(plan.status === 'pending', '状态应变为pending');
  });

  await test('状态转换 - pending -> in_progress', () => {
    const plan = detourService.transitionStatus(testPlanId, 'in_progress', '操作员', '开始执行');
    assert(plan.status === 'in_progress', '状态应变为in_progress');
  });

  await test('生成运行报告', () => {
    const report = detourService.generateReport(testPlanId);
    assert(report, '报告应生成成功');
    assert(report.plan_info, '应有计划信息');
    assert(report.statistics, '应有统计信息');
    assert(report.plan_info.id === testPlanId, '计划ID应匹配');
  });

  await test('人工修正改线计划', async () => {
    const plan = await detourService.manualCorrect(testPlanId, {
      estimated_delay: 45,
      remark: '更新延迟时间'
    }, '修正员');
    assert(plan.estimated_delay === 45, '延迟时间应更新为45');
  });

  console.log(`\n${colors.yellow}--- 阶段3: 回执去重测试 ---${colors.reset}`);

  let testReceipt = null;

  await test('提交家长回执', async () => {
    if (testStudentId) {
      testReceipt = await detourService.addParentReceipt({
        detour_plan_id: testPlanId,
        student_id: testStudentId,
        parent_phone: '13800138000',
        confirm_type: 'confirmed',
        message: '已知悉改道安排',
        is_late: false,
        source: 'wechat'
      });
      assert(testReceipt, '回执应提交成功');
    }
  });

  await test('回执去重 - 重复提交应失败', async () => {
    if (testStudentId) {
      let errorThrown = false;
      try {
        await detourService.addParentReceipt({
          detour_plan_id: testPlanId,
          student_id: testStudentId,
          parent_phone: '13800138000',
          confirm_type: 'confirmed',
          message: '重复提交'
        });
      } catch (error) {
        errorThrown = true;
        assert(error.message.includes('重复提交'), '应提示重复提交');
      }
      assert(errorThrown, '重复提交应抛出错误');
    }
  });

  await test('迟到标记回执', async () => {
    if (testStudentId) {
      const receipt = await detourService.addParentReceipt({
        detour_plan_id: testPlanId,
        student_id: testStudentId,
        parent_phone: '13900139000',
        confirm_type: 'confirmed',
        message: '会晚到十分钟',
        is_late: true,
        late_reason: '起床晚了',
        source: 'sms'
      });
      assert(receipt.is_late === 1, '迟到标记应为1');
    }
  });

  console.log(`\n${colors.yellow}--- 阶段4: 脏数据测试 ---${colors.reset}`);

  await test('查询不存在的改线计划', () => {
    const plan = detourService.getDetourPlanById('non-existent-id');
    assert(!plan, '不存在的ID应返回null');
  });

  await test('非法状态转换应失败', () => {
    let errorThrown = false;
    try {
      detourService.transitionStatus(testPlanId, 'invalid_status', '操作员');
    } catch (error) {
      errorThrown = true;
    }
    assert(errorThrown, '非法状态转换应失败');
  });

  await test('无效状态链转换应失败', () => {
    detourService.transitionStatus(testPlanId, 'completed', '操作员', '完成改线');
    let errorThrown = false;
    try {
      detourService.transitionStatus(testPlanId, 'pending', '操作员');
    } catch (error) {
      errorThrown = true;
    }
    assert(errorThrown, 'completed状态不能转回pending');
  });

  console.log(`\n${colors.yellow}--- 阶段5: 导出内容一致性测试 ---${colors.reset}`);

  await test('报告数据一致性', () => {
    const report = detourService.generateReport(testPlanId);
    const plan = detourService.getDetourPlanById(testPlanId);
    
    assert(report.plan_info.status === plan.status, '报告状态应与计划一致');
    assert(report.plan_info.route_name === plan.route_name, '线路名称应一致');
    
    const receiptCount = report.receipts.length;
    const planReceiptCount = plan.receipts.length;
    assert(receiptCount === planReceiptCount, '回执数量应一致');
  });

  await test('统计数据正确性', () => {
    const report = detourService.generateReport(testPlanId);
    const confirmedCount = report.receipts.filter(r => r.confirm_type === 'confirmed').length;
    const lateCount = report.receipts.filter(r => r.is_late === 1).length;
    
    assert(report.statistics.confirmed_receipts === confirmedCount, '确认回执统计应正确');
    assert(report.statistics.late_count === lateCount, '迟到统计应正确');
    
    if (report.statistics.total_affected_students > 0) {
      const expectedRate = Math.round((confirmedCount / report.statistics.total_affected_students) * 100);
      assert(report.statistics.confirmation_rate === expectedRate, '确认率计算应正确');
    }
  });

  console.log(`\n${colors.yellow}--- 阶段6: 异常日志测试 ---${colors.reset}`);

  await test('记录错误日志', () => {
    detourService.logError('/test/path', 'POST', { foo: 'bar' }, '测试错误', '处理完成');
    const logs = detourService.getErrorLogs();
    assert(logs.length > 0, '应有错误日志记录');
  });

  console.log(`\n${colors.blue}══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`测试结果:`);
  console.log(`  通过: ${colors.green}${passed}${colors.reset}`);
  console.log(`  失败: ${failed > 0 ? colors.red : ''}${failed}${colors.reset}`);
  console.log(`  总计: ${passed + failed}`);

  if (failed === 0) {
    console.log(`\n${colors.green}✓ 所有测试通过！系统运行正常 ✓${colors.reset}`);
  } else {
    console.log(`\n${colors.red}✗ 有 ${failed} 个测试失败，请检查${colors.reset}`);
  }
  console.log(`${colors.blue}══════════════════════════════════════════════════════${colors.reset}\n`);

  db.close();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
