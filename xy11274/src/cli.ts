#!/usr/bin/env node

import { storage } from './storage/StorageManager';
import { LockService } from './services/LockService';
import { ScheduleService } from './services/ScheduleService';
import { ReportService } from './services/ReportService';
import { AuditService } from './services/AuditService';
import { RuleEngine } from './services/RuleEngine';
import { getCurrentTime, formatDate } from './utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

const OPERATOR = '系统管理员';
const ROLE = '班长';
const TODAY = formatDate(new Date());

function printHeader(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70) + '\n');
}

function printResult(result: any) {
  console.log(`状态: ${result.success ? '✅ 成功' : '❌ 失败'}`);
  console.log(`结果: ${result.operationResult === 'allowed' ? '通过' : '拦截'}`);
  console.log(`原因: ${result.reason}`);
  if (result.idempotentKey) {
    console.log(`幂等键: ${result.idempotentKey}`);
  }
}

function initDemoData() {
  printHeader('初始化演示数据');

  const forklift1 = storage.forklifts.create({
    code: 'F001',
    name: '叉车001',
    batteryLevel: 25,
    status: 'available',
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  const forklift2 = storage.forklifts.create({
    code: 'F002',
    name: '叉车002',
    batteryLevel: 45,
    status: 'available',
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  const forklift3 = storage.forklifts.create({
    code: 'F003',
    name: '叉车003',
    batteryLevel: 10,
    status: 'available',
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  const pile1 = storage.chargingPiles.create({
    code: 'P001',
    name: '充电桩001',
    status: 'available',
    power: 100,
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  const pile2 = storage.chargingPiles.create({
    code: 'P002',
    name: '充电桩002',
    status: 'available',
    power: 100,
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  const nightShift = storage.shifts.create({
    date: TODAY,
    shiftType: '夜班',
    startTime: `${TODAY}T20:00:00`,
    endTime: `${TODAY}T04:00:00`,
    manager: OPERATOR,
    status: 'ongoing',
    createdAt: getCurrentTime(),
    updatedAt: getCurrentTime(),
    createdBy: OPERATOR,
    updatedBy: OPERATOR
  });

  console.log('✅ 创建叉车: F001(25%), F002(45%), F003(10%)');
  console.log('✅ 创建充电桩: P001, P002');
  console.log(`✅ 创建班次: 夜班 (${TODAY})`);

  return { forklift1, forklift2, forklift3, pile1, pile2, nightShift };
}

function runLockDemo(data: any) {
  printHeader('演示1: 锁定充电桩');

  console.log('场景1: 低电量叉车F001锁定P001 (电量25% < 30%阈值，享有优先级)');
  const result1 = LockService.acquireLock({
    chargingPileId: data.pile1.id,
    forkliftId: data.forklift1.id,
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `lock-${data.pile1.id}-${data.forklift1.id}-1`
  });
  printResult(result1);
  const lock1Id = result1.result?.id;

  console.log('\n场景2: 重复提交相同请求 (幂等性测试)');
  const result2 = LockService.acquireLock({
    chargingPileId: data.pile1.id,
    forkliftId: data.forklift1.id,
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `lock-${data.pile1.id}-${data.forklift1.id}-1`
  });
  printResult(result2);

  console.log('\n场景3: F002尝试锁定已被占用的P001 (应该被拦截)');
  const result3 = LockService.acquireLock({
    chargingPileId: data.pile1.id,
    forkliftId: data.forklift2.id,
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `lock-${data.pile1.id}-${data.forklift2.id}-1`
  });
  printResult(result3);

  console.log('\n场景4: 极低电量叉车F003锁定P002 (电量10% < 15%临界值)');
  const result4 = LockService.acquireLock({
    chargingPileId: data.pile2.id,
    forkliftId: data.forklift3.id,
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `lock-${data.pile2.id}-${data.forklift3.id}-1`
  });
  printResult(result4);

  return { lock1Id };
}

function runScheduleDemo(data: any) {
  printHeader('演示2: 排班管理');

  console.log('场景1: 为F001创建夜班排班');
  const result1 = ScheduleService.createSchedule({
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    forkliftId: data.forklift1.id,
    forkliftCode: 'F001',
    operatorName: '张师傅',
    taskDescription: 'A区货物搬运',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `schedule-${data.nightShift.id}-${data.forklift1.id}-1`
  });
  printResult(result1);

  console.log('\n场景2: 重复创建相同排班 (幂等性测试)');
  const result2 = ScheduleService.createSchedule({
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    forkliftId: data.forklift1.id,
    forkliftCode: 'F001',
    operatorName: '张师傅',
    taskDescription: 'A区货物搬运',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `schedule-${data.nightShift.id}-${data.forklift1.id}-1`
  });
  printResult(result2);

  console.log('\n场景3: 同一叉车在同一班次重复排班 (应该被拦截)');
  const result3 = ScheduleService.createSchedule({
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    forkliftId: data.forklift1.id,
    forkliftCode: 'F001',
    operatorName: '李师傅',
    taskDescription: 'B区货物搬运',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `schedule-${data.nightShift.id}-${data.forklift1.id}-2`
  });
  printResult(result3);

  console.log('\n场景4: 为F002创建排班');
  const result4 = ScheduleService.createSchedule({
    shiftId: data.nightShift.id,
    date: TODAY,
    shiftType: '夜班',
    forkliftId: data.forklift2.id,
    forkliftCode: 'F002',
    operatorName: '王师傅',
    taskDescription: 'C区货物装卸',
    operator: OPERATOR,
    role: ROLE,
    idempotentKey: `schedule-${data.nightShift.id}-${data.forklift2.id}-1`
  });
  printResult(result4);
}

function runReleaseDemo(data: any, lock1Id: string) {
  printHeader('演示3: 释放与异常处理');

  console.log('场景1: 正常释放P001锁定');
  const result1 = LockService.releaseLock({
    lockId: lock1Id,
    releaseReason: '充电完成，电量已恢复至85%',
    operator: OPERATOR,
    role: ROLE
  });
  printResult(result1);

  console.log('\n场景2: 重复释放已释放的锁定 (应该被拦截)');
  const result2 = LockService.releaseLock({
    lockId: lock1Id,
    releaseReason: '再次尝试释放',
    operator: OPERATOR,
    role: ROLE
  });
  printResult(result2);
}

function runAuditDemo() {
  printHeader('演示4: 审计日志与历史记录');

  const allLogs = AuditService.getAllLogs();
  console.log(`总审计日志条数: ${allLogs.length}`);
  console.log('\n最近5条记录:');
  allLogs.slice(-5).forEach((log, i) => {
    const status = log.operationResult === 'allowed' ? '✅' : '❌';
    console.log(`  ${i + 1}. ${status} ${log.createdAt.slice(11, 19)} | ${log.operator} | ${log.action}`);
    console.log(`     原因: ${log.reason}`);
  });

  const blockedLogs = AuditService.getLogsByResult('blocked');
  console.log(`\n被拦截操作数: ${blockedLogs.length}`);

  const allowedLogs = AuditService.getLogsByResult('allowed');
  console.log(`通过操作数: ${allowedLogs.length}`);
}

function runReportDemo() {
  printHeader('演示5: 日报生成');

  const reportResult = ReportService.generateDailyReport(TODAY, OPERATOR, ROLE);
  if (reportResult.success && reportResult.result) {
    console.log(ReportService.printReport(reportResult.result));
  } else {
    console.log('❌ 日报生成失败:', reportResult.reason);
  }
}

function runRuleDemo() {
  printHeader('演示6: 业务规则查看');

  console.log('当前生效的业务规则:');
  console.log('-'.repeat(50));
  RuleEngine.getAllRules().forEach((rule, i) => {
    console.log(`${i + 1}. ${rule}`);
  });
}

function main() {
  console.clear();
  console.log('\n🚜  叉车排班与充电桩管理系统演示');
  console.log('='.repeat(70));

  storage.clearAll();

  const data = initDemoData();
  const { lock1Id } = runLockDemo(data);
  runScheduleDemo(data);
  if (lock1Id) {
    runReleaseDemo(data, lock1Id);
  }
  runAuditDemo();
  runReportDemo();
  runRuleDemo();

  printHeader('演示总结');
  console.log('✅ 本地持久化: 所有数据已保存至 data/ 目录');
  console.log('✅ 幂等性验证: 重复提交返回相同结果，不会重复处理');
  console.log('✅ 业务规则: 低电量优先、跨班占用检测、状态校验全部生效');
  console.log('✅ 审计追踪: 每步操作都有详细日志记录');
  console.log('✅ 历史记录: 可查询任意实体的操作历史');
  console.log('✅ 日报功能: 可生成每日运营报告');
  console.log('\n📁 数据文件位置: data/*.json');
  console.log('💡 重启程序后数据仍然保留，可验证持久化效果\n');
}

main();
