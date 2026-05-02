const { initDatabase } = require('../src/storage/database');
const topologyService = require('../src/services/topology-service');
const timeRules = require('../src/utils/time-rules');
const conflictChecker = require('../src/services/conflict-checker');
const planStateMachine = require('../src/services/plan-state-machine');

/**
 * 基础测试脚本
 * 测试核心功能模块
 */

let passed = 0;
let failed = 0;
let tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('========================================');
  console.log('封锁点施工冲突审校站 - 基础测试');
  console.log('========================================\n');
  
  for (const { name, fn } of tests) {
    console.log(`\n测试: ${name}`);
    console.log('-'.repeat(50));
    try {
      const result = await fn();
      if (result === true || result === undefined) {
        console.log('  ✅ 通过');
        passed++;
      } else {
        console.log('  ❌ 失败:', result);
        failed++;
      }
    } catch (error) {
      console.log('  ❌ 异常:', error.message);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('测试结果汇总:');
  console.log('  总测试数:', tests.length);
  console.log('  ✅ 通过:', passed);
  console.log('  ❌ 失败:', failed);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// 测试用例

test('1. 时间规则 - 时间重叠检测', () => {
  // 完全重叠
  const t1 = { start_time: '2024-05-20 23:00:00', end_time: '2024-05-21 04:00:00' };
  const t2 = { start_time: '2024-05-20 23:30:00', end_time: '2024-05-21 03:00:00' };
  if (!timeRules.isTimeOverlap(t1, t2)) throw new Error('完全重叠应检测为重叠');
  
  // 部分重叠
  const t3 = { start_time: '2024-05-20 23:00:00', end_time: '2024-05-21 01:00:00' };
  const t4 = { start_time: '2024-05-21 00:30:00', end_time: '2024-05-21 02:00:00' };
  if (!timeRules.isTimeOverlap(t3, t4)) throw new Error('部分重叠应检测为重叠');
  
  // 边界接触（不重叠）
  const t5 = { start_time: '2024-05-20 23:00:00', end_time: '2024-05-21 01:00:00' };
  const t6 = { start_time: '2024-05-21 01:00:00', end_time: '2024-05-21 02:00:00' };
  if (timeRules.isTimeOverlap(t5, t6)) throw new Error('边界接触不应检测为重叠');
  
  return true;
});

test('2. 时间规则 - 安全缓冲检查', () => {
  // 时间过近，不安全（距离首班车时间）
  const t1 = { end_time: '2024-05-21 05:20:00', first_train_time: '2024-05-21 05:30:00' };
  const safety1 = timeRules.checkSafetyBuffer(t1, '2024-05-21 05:30:00');
  if (safety1.safe) throw new Error('10分钟缓冲应检测为不安全');
  
  // 时间足够安全
  const t2 = { end_time: '2024-05-21 04:30:00', first_train_time: '2024-05-21 05:30:00' };
  const safety2 = timeRules.checkSafetyBuffer(t2, '2024-05-21 05:30:00');
  if (!safety2.safe) throw new Error('60分钟缓冲应检测为安全');
  
  return true;
});

test('3. 时间规则 - 夜间窗口验证', () => {
  // 标准夜间窗口
  const t1 = { start_time: '2024-05-20 23:00:00', end_time: '2024-05-21 04:00:00' };
  const result1 = timeRules.validateNightWindow(t1);
  if (!result1.valid) throw new Error('标准夜间窗口应有效');
  
  // 跨越多夜
  const t2 = { start_time: '2024-05-20 23:00:00', end_time: '2024-05-22 04:00:00' };
  const result2 = timeRules.validateNightWindow(t2);
  if (result2.valid) throw new Error('跨越多夜应无效');
  
  return true;
});

test('4. 拓扑服务 - 线路和车站创建', async () => {
  // 等待数据库初始化
  await initDatabase();
  
  // 创建线路
  const line = topologyService.createLine({
    id: 'TEST-LINE-001',
    name: '测试线路',
    color: '#FF0000'
  });
  if (!line || line.id !== 'TEST-LINE-001') throw new Error('线路创建失败');
  
  // 获取线路
  const getLine = topologyService.getLine('TEST-LINE-001');
  if (!getLine) throw new Error('获取线路失败');
  
  // 创建车站
  const station = topologyService.createStation({
    id: 'TEST-ST-001',
    line_id: 'TEST-LINE-001',
    name: '测试站',
    sequence: 0,
    is_terminal: true
  });
  if (!station || station.id !== 'TEST-ST-001') throw new Error('车站创建失败');
  
  // 获取车站
  const getStation = topologyService.getStation('TEST-ST-001');
  if (!getStation) throw new Error('获取车站失败');
  
  return true;
});

test('5. 拓扑服务 - 区间创建和连通性', async () => {
  // 创建更多车站
  const station2 = topologyService.createStation({
    id: 'TEST-ST-002',
    line_id: 'TEST-LINE-001',
    name: '测试站2',
    sequence: 1
  });
  
  // 创建区间
  const section = topologyService.createSection({
    id: 'TEST-SEC-001',
    line_id: 'TEST-LINE-001',
    name: '测试区间',
    start_station_id: 'TEST-ST-001',
    end_station_id: 'TEST-ST-002',
    length_km: 2.0
  });
  if (!section) throw new Error('区间创建失败');
  
  // 检查区间连通性
  const isConnected = topologyService.areSectionsConnected(
    'TEST-SEC-001', 
    'TEST-SEC-001'
  );
  if (!isConnected) throw new Error('同一区间应视为连通');
  
  // 获取线路拓扑
  const topology = topologyService.getLineTopology('TEST-LINE-001');
  if (!topology || topology.sections.length !== 1) throw new Error('获取线路拓扑失败');
  
  return true;
});

test('6. 冲突检查器 - 时间冲突检测', () => {
  const planA = {
    id: 'PLAN-A',
    plan_number: 'BLK-A',
    start_time: '2024-05-20 23:00:00',
    end_time: '2024-05-21 04:00:00',
    section_ids: ['SEC-001', 'SEC-002']
  };
  
  const planB = {
    id: 'PLAN-B',
    plan_number: 'BLK-B',
    start_time: '2024-05-21 00:00:00',
    end_time: '2024-05-21 03:00:00',
    section_ids: ['SEC-002', 'SEC-003']
  };
  
  const conflicts = conflictChecker.checkTimeConflict(planA, planB);
  if (!conflicts.hasConflict) throw new Error('时间重叠应检测为冲突');
  if (!conflicts.details.timeOverlap) throw new Error('应包含时间重叠详情');
  
  return true;
});

test('7. 冲突检查器 - 资源冲突检测', () => {
  const planA = {
    id: 'PLAN-A',
    plan_number: 'BLK-A',
    construction_team_id: 'TEAM-001',
    catenary_zone_ids: ['CAT-001', 'CAT-002']
  };
  
  const planB = {
    id: 'PLAN-B',
    plan_number: 'BLK-B',
    construction_team_id: 'TEAM-001',
    catenary_zone_ids: ['CAT-002', 'CAT-003']
  };
  
  const conflicts = conflictChecker.checkResourceConflict(planA, planB);
  if (!conflicts.hasConflict) throw new Error('资源重叠应检测为冲突');
  if (!conflicts.details.teamConflict) throw new Error('应包含施工队冲突详情');
  if (!conflicts.details.catenaryConflict) throw new Error('应包含接触网冲突详情');
  
  return true;
});

test('8. 计划状态机 - 创建计划', () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  const plan = planStateMachine.createPlan({
    plan_number: 'BLK-TEST-001',
    line_id: 'TEST-LINE-001',
    work_type: '轨道检修',
    work_content: '测试计划',
    construction_team_id: 'TEAM-001',
    priority: 1,
    is_emergency: false,
    start_time: `${dateStr} 23:00:00`,
    end_time: `${tomorrowStr} 04:00:00`,
    first_train_time: `${tomorrowStr} 05:30:00`,
    section_ids: ['TEST-SEC-001']
  });
  
  if (!plan) throw new Error('创建计划失败');
  if (plan.status !== 'draft') throw new Error('新计划状态应为 draft');
  
  // 获取计划
  const getPlan = planStateMachine.getPlan(plan.id);
  if (!getPlan) throw new Error('获取计划失败');
  
  return true;
});

test('9. 计划状态机 - 状态流转', () => {
  // 创建计划
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  const plan = planStateMachine.createPlan({
    plan_number: 'BLK-TEST-002',
    line_id: 'TEST-LINE-001',
    work_type: '轨道检修',
    work_content: '状态流转测试',
    construction_team_id: 'TEAM-001',
    priority: 1,
    is_emergency: false,
    start_time: `${dateStr} 23:00:00`,
    end_time: `${tomorrowStr} 04:00:00`,
    first_train_time: `${tomorrowStr} 05:30:00`,
    section_ids: ['TEST-SEC-001']
  });
  
  // 提交计划
  const submitted = planStateMachine.submitPlan(plan.id, '测试审批人');
  if (!submitted || submitted.status !== 'submitted') throw new Error('提交计划失败');
  
  // 审批计划
  const approved = planStateMachine.approvePlan(plan.id, '测试审批人', { approved: true, comments: '同意' });
  if (!approved || approved.status !== 'approved') throw new Error('审批计划失败');
  
  // 执行计划
  const executing = planStateMachine.executePlan(plan.id, '测试执行人');
  if (!executing || executing.status !== 'executing') throw new Error('执行计划失败');
  
  // 完成计划
  const completed = planStateMachine.completePlan(plan.id, '测试执行人', { actual_end_time: `${tomorrowStr} 03:30:00` });
  if (!completed || completed.status !== 'completed') throw new Error('完成计划失败');
  
  return true;
});

test('10. 计划状态机 - 撤销计划', () => {
  // 创建计划
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  const plan = planStateMachine.createPlan({
    plan_number: 'BLK-TEST-003',
    line_id: 'TEST-LINE-001',
    work_type: '轨道检修',
    work_content: '撤销测试',
    construction_team_id: 'TEAM-001',
    priority: 1,
    is_emergency: false,
    start_time: `${dateStr} 23:00:00`,
    end_time: `${tomorrowStr} 04:00:00`,
    first_train_time: `${tomorrowStr} 05:30:00`,
    section_ids: ['TEST-SEC-001']
  });
  
  // 先提交
  planStateMachine.submitPlan(plan.id, '测试审批人');
  
  // 撤销
  const cancelled = planStateMachine.cancelPlan(plan.id, '测试撤销人', '测试撤销原因');
  if (!cancelled || cancelled.status !== 'cancelled') throw new Error('撤销计划失败');
  
  return true;
});

test('11. 计划状态机 - 紧急插单优先级', () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  // 创建高优先级紧急计划
  const emergencyPlan = planStateMachine.createPlan({
    plan_number: 'BLK-EMERG-001',
    line_id: 'TEST-LINE-001',
    work_type: '紧急抢修',
    work_content: '紧急抢修测试',
    construction_team_id: 'TEAM-001',
    priority: 10,
    is_emergency: true,
    start_time: `${dateStr} 23:00:00`,
    end_time: `${tomorrowStr} 04:00:00`,
    first_train_time: `${tomorrowStr} 05:30:00`,
    section_ids: ['TEST-SEC-001']
  });
  
  if (!emergencyPlan.is_emergency) throw new Error('紧急计划标记应为 true');
  if (emergencyPlan.priority !== 10) throw new Error('紧急计划优先级应为 10');
  
  return true;
});

// 运行测试
runTests();
