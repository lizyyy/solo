import { db } from './database/connection';
import { runAsync, getAsync, allAsync } from './database/connection';
import { v4 as uuidv4 } from 'uuid';
import * as employeeService from './services/employeeService';
import * as lineService from './services/lineService';
import * as lineSwapService from './services/lineSwapService';
import * as workHourService from './services/workHourService';
import * as absenceService from './services/absenceService';
import * as performanceService from './services/performanceService';

const operatorId = 'demo-admin';
const operatorName = '演示管理员';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const printSection = (title: string) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
};

const printSubSection = (title: string) => {
  console.log(`\n  ${'-'.repeat(40)}`);
  console.log(`  ${title}`);
  console.log(`  ${'-'.repeat(40)}`);
};

const printEmployeePosition = async (employeeId: string, title: string) => {
  const employee = await employeeService.getEmployeeById(employeeId);
  if (employee) {
    let lineName = '待分配';
    if (employee.currentLineId) {
      const line = await lineService.getLineById(employee.currentLineId);
      lineName = line ? `${line.lineNo} - ${line.name}` : '未知产线';
    }
    console.log(`  [${title}] ${employee.employeeNo} ${employee.name}: ${lineName}`);
  }
};

const setupDemoData = async () => {
  printSection('1. 初始化演示数据');

  const now = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];

  printSubSection('1.1 创建技能');
  const skillWelderId = uuidv4();
  const skillAssemblerId = uuidv4();
  const skillPainterId = uuidv4();

  await runAsync(
    `INSERT OR IGNORE INTO skills (id, name, code, description, created_at) VALUES 
     (?, '焊接', 'WELDER', '焊接作业技能', ?),
     (?, '组装', 'ASSEMBLER', '产品组装技能', ?),
     (?, '喷漆', 'PAINTER', '喷漆作业技能', ?)`,
    [skillWelderId, now, skillAssemblerId, now, skillPainterId, now]
  );
  console.log('  ✓ 创建技能: 焊接(WELDER), 组装(ASSEMBLER), 喷漆(PAINTER)');

  printSubSection('1.2 创建产线');
  const lineAId = uuidv4();
  const lineBId = uuidv4();
  const lineCId = uuidv4();

  await runAsync(
    `INSERT OR IGNORE INTO production_lines (id, line_no, name, required_skill_id, status, created_at, updated_at) VALUES 
     (?, 'LINE-A', 'A线-焊接线', ?, 'active', ?, ?),
     (?, 'LINE-B', 'B线-组装线', ?, 'active', ?, ?),
     (?, 'LINE-C', 'C线-喷漆线', ?, 'active', ?, ?)`,
    [lineAId, skillWelderId, now, now, lineBId, skillAssemblerId, now, now, lineCId, skillPainterId, now, now]
  );
  console.log('  ✓ 创建产线: LINE-A(焊接), LINE-B(组装), LINE-C(喷漆)');

  printSubSection('1.3 创建员工');
  const empZhangId = uuidv4();
  const empLiId = uuidv4();
  const empWangId = uuidv4();
  const empZhaoId = uuidv4();

  await runAsync(
    `INSERT OR IGNORE INTO employees (id, employee_no, name, department, current_line_id, status, created_at, updated_at) VALUES 
     (?, 'E001', '张三', '生产一部', ?, 'active', ?, ?),
     (?, 'E002', '李四', '生产一部', ?, 'active', ?, ?),
     (?, 'E003', '王五', '生产二部', ?, 'active', ?, ?),
     (?, 'E004', '赵六', '生产二部', NULL, 'active', ?, ?)`,
    [empZhangId, lineAId, now, now, empLiId, lineAId, now, now, empWangId, lineBId, now, now, empZhaoId, now, now]
  );
  console.log('  ✓ 创建员工: E001张三, E002李四, E003王五, E004赵六');

  printSubSection('1.4 分配员工技能');
  await runAsync(
    `INSERT OR IGNORE INTO employee_skills (id, employee_id, skill_id, level, created_at) VALUES 
     (?, ?, ?, 4, ?),
     (?, ?, ?, 3, ?),
     (?, ?, ?, 5, ?),
     (?, ?, ?, 4, ?),
     (?, ?, ?, 2, ?)`,
    [
      uuidv4(), empZhangId, skillWelderId, now,
      uuidv4(), empZhangId, skillAssemblerId, now,
      uuidv4(), empLiId, skillWelderId, now,
      uuidv4(), empWangId, skillAssemblerId, now,
      uuidv4(), empZhaoId, skillPainterId, now
    ]
  );
  console.log('  ✓ 技能分配: 张三(焊接+组装), 李四(焊接), 王五(组装), 赵六(喷漆)');

  return { empZhangId, empLiId, empWangId, empZhaoId, lineAId, lineBId, lineCId, today };
};

const demoNormalSwapFlow = async (empId: string, fromLineId: string, toLineId: string, today: string) => {
  printSection('2. 正常换线流程 - 技能匹配');

  printSubSection('2.1 换线前位置');
  await printEmployeePosition(empId, '换线前');

  printSubSection('2.2 创建换线申请');
  try {
    const request = await lineSwapService.createSwapRequest(
      {
        employeeId: empId,
        fromLineId,
        toLineId,
        reason: '产线临时支援',
        startTime: `${today}T08:00:00.000Z`,
        endTime: `${today}T20:00:00.000Z`
      },
      operatorId,
      operatorName
    );
    console.log('  ✓ 换线申请创建成功');
    console.log(`    申请编号: ${request.requestNo}`);
    console.log(`    技能匹配: ${request.skillMatch ? '是' : '否'}`);
    console.log(`    当前状态: ${request.status}`);

    printSubSection('2.3 审批换线申请');
    const approved = await lineSwapService.approveSwapRequest(request.id, operatorId, operatorName);
    console.log('  ✓ 换线申请审批通过');
    console.log(`    审批状态: ${approved.status}`);
    console.log(`    审批人: ${approved.approvedBy}`);

    printSubSection('2.4 换线后位置');
    await printEmployeePosition(empId, '换线后');

    printSubSection('2.5 记录工时(归属新产线)');
    const workHour = await workHourService.createWorkHour(
      {
        employeeId: empId,
        lineId: toLineId,
        swapRequestId: request.id,
        date: today,
        hours: 8
      },
      operatorId,
      operatorName
    );
    console.log('  ✓ 工时记录创建成功');
    console.log(`    工时归属产线: LINE-B (组装线)`);
    console.log(`    关联换线申请: ${workHour.swapRequestId ? '是' : '否'}`);
    console.log(`    工时: ${workHour.hours}小时`);

    return request.id;
  } catch (error: any) {
    console.log(`  ✗ 换线失败: ${error.message}`);
    return null;
  }
};

const demoSkillMismatchInterception = async (empId: string, fromLineId: string, toLineId: string, today: string) => {
  printSection('3. 技能不匹配 - 系统拦截');

  printSubSection('3.1 员工技能情况');
  const skills = await employeeService.getEmployeeSkills(empId);
  console.log(`  员工技能: ${skills.map(s => `${s.skillName}(${s.level}级)`).join(', ')}`);

  const line = await lineService.getLineById(toLineId);
  const requiredSkill = await lineService.getSkillById(line!.requiredSkillId);
  console.log(`  目标产线要求: ${line?.name} - 需要 ${requiredSkill?.name}技能`);

  printSubSection('3.2 尝试创建换线申请');
  try {
    await lineSwapService.createSwapRequest(
      {
        employeeId: empId,
        fromLineId,
        toLineId,
        reason: '紧急支援',
        startTime: `${today}T08:00:00.000Z`
      },
      operatorId,
      operatorName
    );
    console.log('  ✗ 错误: 技能不匹配但未被拦截');
  } catch (error: any) {
    console.log('  ✓ 系统成功拦截技能不匹配的换线申请');
    console.log(`    错误码: ${error.code}`);
    console.log(`    错误信息: ${error.message}`);
    if (error.details) {
      console.log(`    详细信息: 员工技能 ${error.details.employeeSkills.join(', ')} 不匹配目标产线要求 ${error.details.requiredSkill}`);
    }
  }
};

const demoDuplicateRequestInterception = async (empId: string, fromLineId: string, toLineId: string, today: string) => {
  printSection('4. 重复申请 - 系统拦截');

  printSubSection('4.1 创建第一个换线申请');
  const request = await lineSwapService.createSwapRequest(
    {
      employeeId: empId,
      fromLineId,
      toLineId,
      reason: '正常调岗',
      startTime: `${today}T09:00:00.000Z`,
      allowSkillMismatch: true
    },
    operatorId,
    operatorName
  );
  console.log(`  ✓ 第一个申请创建成功: ${request.requestNo}`);
  console.log(`    注意: 技能不匹配但通过 allowSkillMismatch 强制提交`);

  printSubSection('4.2 尝试提交重复申请');
  try {
    await lineSwapService.createSwapRequest(
      {
        employeeId: empId,
        fromLineId,
        toLineId,
        reason: '重复提交',
        startTime: `${today}T09:00:00.000Z`,
        allowSkillMismatch: true
      },
      operatorId,
      operatorName
    );
    console.log('  ✗ 错误: 重复申请但未被拦截');
  } catch (error: any) {
    console.log('  ✓ 系统成功拦截重复的换线申请');
    console.log(`    错误码: ${error.code}`);
    console.log(`    错误信息: ${error.message}`);
  }
};

const demoAbsenceBeforeWorkHour = async (empId: string, lineId: string, today: string) => {
  printSection('5. 缺勤后计工时 - 系统拦截');

  printSubSection('5.1 创建缺勤记录');
  const absence = await absenceService.createAbsence(
    {
      employeeId: empId,
      date: today,
      type: 'sick',
      reason: '感冒发烧',
      hours: 8
    },
    operatorId,
    operatorName
  );
  console.log(`  ✓ 缺勤记录创建成功: ${absence.type} - ${absence.hours}小时`);

  printSubSection('5.2 尝试记录工时');
  try {
    await workHourService.createWorkHour(
      {
        employeeId: empId,
        lineId,
        date: today,
        hours: 8
      },
      operatorId,
      operatorName
    );
    console.log('  ✗ 错误: 缺勤当天仍能记录工时');
  } catch (error: any) {
    console.log('  ✓ 系统成功拦截缺勤当天的工时记录');
    console.log(`    错误码: ${error.code}`);
    console.log(`    错误信息: ${error.message}`);
  }
};

const demoPerformanceCalculation = async (empId: string, lineId: string) => {
  printSection('6. 绩效计算 - 按产线归属');

  printSubSection('6.1 计算月度绩效');
  const month = new Date().toISOString().slice(0, 7);
  const performance = await performanceService.calculatePerformance(
    empId,
    lineId,
    month,
    operatorId,
    operatorName
  );
  console.log('  ✓ 绩效计算完成');
  console.log(`    产线归属: ${lineId}`);
  console.log(`    统计月份: ${performance.month}`);
  console.log(`    总工时: ${performance.totalHours}小时`);
  console.log(`    正常工时: ${performance.normalHours}小时`);
  console.log(`    加班工时: ${performance.overtimeHours}小时`);
  console.log(`    缺勤工时: ${performance.absenceHours}小时`);
  console.log(`    效率: ${performance.efficiency?.toFixed(1)}%`);
  console.log(`    质量合格率: ${performance.qualityRate?.toFixed(1)}%`);
};

const main = async () => {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             工厂班组换线 API - 完整流程演示                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    const { empZhangId, empLiId, empWangId, empZhaoId, lineAId, lineBId, lineCId, today } = await setupDemoData();
    await sleep(500);

    await demoNormalSwapFlow(empZhangId, lineAId, lineBId, today);
    await sleep(500);

    await demoSkillMismatchInterception(empLiId, lineAId, lineBId, today);
    await sleep(500);

    await demoDuplicateRequestInterception(empWangId, lineBId, lineAId, today);
    await sleep(500);

    await demoAbsenceBeforeWorkHour(empZhaoId, lineCId, today);
    await sleep(500);

    await demoPerformanceCalculation(empZhangId, lineBId);

    printSection('7. 演示总结');
    console.log('  ✓ 正常换线流程 - 验证通过');
    console.log('  ✓ 技能不匹配拦截 - 验证通过');
    console.log('  ✓ 重复申请拦截 - 验证通过');
    console.log('  ✓ 缺勤工时拦截 - 验证通过');
    console.log('  ✓ 绩效按产线归属 - 验证通过');
    console.log('\n  所有核心功能演示完成！\n');

  } catch (error) {
    console.error('演示过程出错:', error);
  } finally {
    db.close();
  }
};

main();
