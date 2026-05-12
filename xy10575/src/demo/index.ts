import { equipmentService } from '../services/equipmentService';
import { templateService } from '../services/templateService';
import { inspectionService } from '../services/inspectionService';
import { exceptionService } from '../services/exceptionService';
import { reportService } from '../services/reportService';
import { 
  EquipmentStatus, CheckType, ItemType, 
  InspectionStatus, ExceptionStatus, RecheckStatus,
  MaintenanceStatus
} from '../models';
import moment from 'moment';

const operators = {
  zhangsan: { id: 'user-001', name: '张三' },
  lisi: { id: 'user-002', name: '李四' },
  wangwu: { id: 'user-003', name: '王五' },
  zhaoliu: { id: 'user-004', name: '赵六' }
};

const today = moment().format('YYYY-MM-DD');

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function createSampleData() {
  console.log('========================================');
  console.log('开始创建样例数据...');
  console.log('========================================\n');

  console.log('--- 1. 创建设备档案 ---');
  const cnc1 = await equipmentService.create({
    name: 'CNC加工中心-A1',
    code: 'CNC-001',
    location: '1号车间',
    type: 'CNC加工中心',
    status: EquipmentStatus.RUNNING
  }, operators.zhangsan);
  console.log(`✓ 设备: ${cnc1.name} (ID: ${cnc1.id})`);

  const cnc2 = await equipmentService.create({
    name: 'CNC加工中心-A2',
    code: 'CNC-002',
    location: '1号车间',
    type: 'CNC加工中心',
    status: EquipmentStatus.RUNNING
  }, operators.zhangsan);
  console.log(`✓ 设备: ${cnc2.name} (ID: ${cnc2.id})`);

  console.log('\n--- 2. 创建点检模板和项目 ---');
  const template = await templateService.createTemplate({
    equipmentId: cnc1.id,
    checkType: CheckType.DAILY,
    name: '日常点检模板',
    description: 'CNC加工中心日常点检'
  }, operators.zhangsan);
  console.log(`✓ 模板: ${template.name} (ID: ${template.id})`);

  const item1 = await templateService.addItem({
    templateId: template.id,
    name: '主轴温度',
    itemType: ItemType.KEY,
    standard: '≤60℃',
    method: '红外线测温',
    sortOrder: 1
  }, operators.zhangsan);
  console.log(`✓ 点检项目(关键): ${item1.name}`);

  const item2 = await templateService.addItem({
    templateId: template.id,
    name: '液压油位',
    itemType: ItemType.NORMAL,
    standard: '在刻度范围内',
    method: '目视检查',
    sortOrder: 2
  }, operators.zhangsan);
  console.log(`✓ 点检项目(普通): ${item2.name}`);

  const item3 = await templateService.addItem({
    templateId: template.id,
    name: '冷却系统',
    itemType: ItemType.KEY,
    standard: '正常运行，无异响',
    method: '目视+听觉',
    sortOrder: 3
  }, operators.zhangsan);
  console.log(`✓ 点检项目(关键): ${item3.name}`);

  const item4 = await templateService.addItem({
    templateId: template.id,
    name: '工作台清洁',
    itemType: ItemType.NORMAL,
    standard: '无杂物、无油污',
    method: '目视检查',
    sortOrder: 4
  }, operators.zhangsan);
  console.log(`✓ 点检项目(普通): ${item4.name}`);

  return {
    equipment: { cnc1, cnc2 },
    template,
    items: { item1, item2, item3, item4 },
    operators
  };
}

export async function demoNormalInspection(data: Awaited<ReturnType<typeof createSampleData>>) {
  console.log('\n\n========================================');
  console.log('【场景一】正常点检流程演示');
  console.log('========================================\n');

  const { equipment, template, items, operators } = data;
  const operator = operators.lisi;

  console.log(`> 点检设备: ${equipment.cnc1.name}`);
  console.log(`> 点检人: ${operator.name}`);
  console.log(`> 日期: ${today}`);
  console.log(`> 班次: 早班\n`);

  const inspection = await inspectionService.create({
    equipmentId: equipment.cnc1.id,
    templateId: template.id,
    shift: '早班',
    shiftDate: today,
    idempotentKey: `inspect-${equipment.cnc1.id}-${today}-morning`
  }, operator);
  console.log(`✓ 创建点检记录`);
  console.log(`  - 状态: ${inspection.status}`);
  console.log(`  - ID: ${inspection.id}`);

  await delay(100);
  await inspectionService.checkItem(inspection.id, {
    itemId: items.item1.id,
    actualValue: '45℃',
    isNormal: true
  }, operator);
  console.log(`✓ 点检项目: 主轴温度 (45℃) - 正常`);

  await delay(100);
  await inspectionService.checkItem(inspection.id, {
    itemId: items.item2.id,
    actualValue: '正常',
    isNormal: true
  }, operator);
  console.log(`✓ 点检项目: 液压油位 - 正常`);

  await delay(100);
  await inspectionService.checkItem(inspection.id, {
    itemId: items.item3.id,
    actualValue: '运行正常',
    isNormal: true
  }, operator);
  console.log(`✓ 点检项目: 冷却系统 - 正常`);

  await delay(100);
  await inspectionService.checkItem(inspection.id, {
    itemId: items.item4.id,
    actualValue: '清洁',
    isNormal: true
  }, operator);
  console.log(`✓ 点检项目: 工作台清洁 - 正常`);

  await delay(100);
  const completed = await inspectionService.complete(inspection.id, operator);
  console.log(`\n✓ 完成点检`);
  console.log(`  - 状态: ${completed.status}`);

  await delay(100);
  const closed = await inspectionService.close(inspection.id, operator);
  console.log(`✓ 关闭点检`);
  console.log(`  - 最终状态: ${closed.status}`);

  const report = await reportService.getShiftInspectionReport(inspection.id);
  console.log('\n--- 点检报告 ---');
  console.log(`  点检项目数: ${report.totalItems}`);
  console.log(`  正常项目: ${report.normalItems}`);
  console.log(`  异常项目: ${report.abnormalItems}`);
  console.log(`  关键项目: ${report.keyItems}/${report.keyItemsNormal}`);

  const history = await reportService.getHistory('INSPECTION', inspection.id);
  console.log(`\n--- 状态变化历史 (${history.length}条) ---`);
  history.forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.action}: ${h.fromStatus || '-'} → ${h.toStatus || '-'} [${h.operatorName}]`);
  });

  return inspection;
}

export async function demoKeyExceptionWithDowntime(data: Awaited<ReturnType<typeof createSampleData>>) {
  console.log('\n\n========================================');
  console.log('【场景二】关键异常停机闭环流程');
  console.log('========================================\n');

  const { equipment, template, items, operators } = data;
  const inspector = operators.lisi;
  const maintainer = operators.wangwu;
  const rechecker = operators.zhaoliu;

  console.log(`> 点检设备: ${equipment.cnc2.name}`);
  console.log(`> 日期: ${today}`);
  console.log(`> 班次: 中班\n`);

  const inspection = await inspectionService.create({
    equipmentId: equipment.cnc2.id,
    templateId: template.id,
    shift: '中班',
    shiftDate: today,
    idempotentKey: `inspect-${equipment.cnc2.id}-${today}-afternoon`
  }, inspector);
  console.log(`✓ 创建点检记录 - 状态: ${inspection.status}`);

  await delay(100);
  await inspectionService.checkItem(inspection.id, {
    itemId: items.item1.id,
    actualValue: '75℃',
    isNormal: false,
    remark: '主轴温度过高，超过标准值15℃'
  }, inspector);
  console.log(`✓ 点检关键项: 主轴温度 (75℃) - 异常！`);

  const equipmentAfter = await equipmentService.getById(equipment.cnc2.id);
  console.log(`  > 设备状态自动变为: ${equipmentAfter?.status}`);

  const inspectionAfter = await inspectionService.getById(inspection.id);
  console.log(`  > 点检状态自动变为: ${inspectionAfter?.status}`);

  const itemResults = await inspectionService.getItemResults(inspection.id);
  const abnormalResult = itemResults.find(r => !r.isNormal);
  
  const exception = await exceptionService.reportException({
    inspectionId: inspection.id,
    itemResultId: abnormalResult?.id,
    description: '主轴温度过高，超过标准值15℃',
    level: 'CRITICAL'
  }, inspector);
  
  console.log(`\n✓ 异常记录已生成`);
  console.log(`  - 等级: ${exception.level}`);
  console.log(`  - 状态: ${exception.status}`);
  console.log(`  - ID: ${exception.id}`);

  await delay(500);
  const downtime = await exceptionService.createDowntime({
    equipmentId: equipment.cnc2.id,
    exceptionId: exception.id,
    inspectionId: inspection.id,
    reason: '主轴温度过高，需停机检查',
    idempotentKey: `downtime-${exception.id}`
  }, inspector);
  console.log(`\n✓ 安排设备停机`);
  console.log(`  - 原因: ${downtime.reason}`);
  console.log(`  - 开始时间: ${downtime.startTime}`);

  const equipmentStopped = await equipmentService.getById(equipment.cnc2.id);
  console.log(`  > 设备状态: ${equipmentStopped?.status}`);

  const exceptionAfterDowntime = await exceptionService.getExceptionById(exception.id);
  console.log(`  > 异常状态: ${exceptionAfterDowntime?.status}`);

  await delay(1000);
  const maintenance = await exceptionService.assignMaintenance({
    exceptionId: exception.id,
    assigneeId: maintainer.id,
    assigneeName: maintainer.name,
    priority: 'HIGH',
    description: '主轴过热，检查冷却系统和轴承磨损情况',
    idempotentKey: `maint-${exception.id}`
  }, inspector);
  console.log(`\n✓ 维修派工给 ${maintainer.name}`);
  console.log(`  - 优先级: ${maintenance.priority}`);
  console.log(`  - 状态: ${maintenance.status}`);

  const equipmentMaintenance = await equipmentService.getById(equipment.cnc2.id);
  console.log(`  > 设备状态: ${equipmentMaintenance?.status}`);

  const exceptionAfterMaint = await exceptionService.getExceptionById(exception.id);
  console.log(`  > 异常状态: ${exceptionAfterMaint?.status}`);

  await delay(500);
  await exceptionService.startMaintenance(maintenance.id, maintainer);
  console.log(`\n✓ ${maintainer.name} 开始维修`);

  await delay(2000);
  await exceptionService.completeMaintenance(maintenance.id, '更换轴承润滑油，清理冷却系统水垢，测试运行正常', maintainer);
  console.log(`\n✓ ${maintainer.name} 完成维修`);
  console.log(`  - 维修结果: 更换轴承润滑油，清理冷却系统水垢...`);

  const exceptionAfterComplete = await exceptionService.getExceptionById(exception.id);
  console.log(`  > 异常状态: ${exceptionAfterComplete?.status}`);

  await delay(1000);
  const recheck = await exceptionService.recheck({
    exceptionId: exception.id,
    result: RecheckStatus.PASSED,
    remark: '复检主轴温度为42℃，在正常范围内',
    idempotentKey: `recheck-${exception.id}`
  }, rechecker);
  console.log(`\n✓ ${rechecker.name} 复检通过`);
  console.log(`  - 结果: ${recheck.result}`);

  const exceptionResolved = await exceptionService.getExceptionById(exception.id);
  console.log(`  > 异常状态: ${exceptionResolved?.status}`);
  console.log(`  > 解决时间: ${exceptionResolved?.resolvedAt}`);

  const equipmentRunning = await equipmentService.getById(equipment.cnc2.id);
  console.log(`  > 设备状态恢复: ${equipmentRunning?.status}`);

  await delay(500);
  await exceptionService.endDowntime(downtime.id, inspector);
  console.log(`\n✓ 结束停机记录`);

  const downtimeEnded = await exceptionService.getAllDowntime({ equipmentId: equipment.cnc2.id });
  const ended = downtimeEnded[0];
  console.log(`  - 停机时长: ${ended.durationMinutes} 分钟`);

  const timeline = await reportService.getExceptionTimeline(exception.id);
  console.log(`\n--- 异常时间线 (${timeline.length}个事件) ---`);
  timeline.forEach((e, i) => {
    console.log(`  ${i + 1}. [${e.type}] ${moment(e.timestamp).format('HH:mm:ss')} - ${e.description} (${e.operator})`);
  });

  const history = await reportService.getHistory('EXCEPTION', exception.id);
  console.log(`\n--- 异常历史记录 (${history.length}条) ---`);
  history.forEach((h, i) => {
    console.log(`  ${i + 1}. ${h.action}: ${h.fromStatus || '-'} → ${h.toStatus || '-'} [${h.operatorName}]`);
  });

  return { inspection, exception, downtime, maintenance, recheck };
}

export async function demoRepeatSubmission(data: Awaited<ReturnType<typeof createSampleData>>) {
  console.log('\n\n========================================');
  console.log('【场景三】重复提交幂等性演示');
  console.log('========================================\n');

  const { equipment, operators } = data;
  const operator = operators.zhangsan;
  const idempotentKey = `test-idempotent-${Date.now()}`;

  console.log('> 第一次提交点检...');
  const inspection1 = await inspectionService.create({
    equipmentId: equipment.cnc1.id,
    templateId: (await templateService.getTemplatesByEquipment(equipment.cnc1.id))[0].id,
    shift: '晚班',
    shiftDate: today,
    idempotentKey
  }, operator);
  console.log(`✓ 第一次提交 - ID: ${inspection1.id}`);

  console.log('\n> 重复提交（相同idempotentKey）...');
  const inspection2 = await inspectionService.create({
    equipmentId: equipment.cnc1.id,
    templateId: (await templateService.getTemplatesByEquipment(equipment.cnc1.id))[0].id,
    shift: '晚班',
    shiftDate: today,
    idempotentKey
  }, operator);
  console.log(`✓ 重复提交 - ID: ${inspection2.id}`);
  console.log(`  > 是否相同记录: ${inspection1.id === inspection2.id ? '是 ✓' : '否 ✗'}`);

  console.log('\n> 不使用idempotentKey提交同一班次...');
  try {
    await inspectionService.create({
      equipmentId: equipment.cnc1.id,
      templateId: (await templateService.getTemplatesByEquipment(equipment.cnc1.id))[0].id,
      shift: '早班',
      shiftDate: today
    }, operator);
    console.log('  ✗ 应该报错但没有报错');
  } catch (e: any) {
    console.log(`✓ 正确报错: ${e.message}`);
  }

  return { inspection1, inspection2 };
}

export async function demoDashboard() {
  console.log('\n\n========================================');
  console.log('【数据看板】设备状态和统计');
  console.log('========================================\n');

  const stats = await reportService.getDashboardStats(today);
  console.log('--- 今日统计 ---');
  console.log(`  设备总数: ${stats.totalEquipment}`);
  console.log(`  运行中: ${stats.runningEquipment}`);
  console.log(`  停机中: ${stats.stoppedEquipment}`);
  console.log(`  维修中: ${stats.maintenanceEquipment}`);
  console.log(`  异常: ${stats.abnormalEquipment}`);
  console.log(`  今日点检数: ${stats.todayInspections}`);
  console.log(`  今日异常数: ${stats.todayExceptions}`);
  console.log(`  今日停机时长: ${stats.totalDowntimeTodayMinutes} 分钟`);
  console.log(`  待处理维修: ${stats.pendingMaintenance}`);

  const allEquipment = await equipmentService.getAll();
  console.log('\n--- 各设备状态 ---');
  for (const eq of allEquipment) {
    const status = await reportService.getEquipmentStatus(eq.id);
    console.log(`\n  ${eq.name}:`);
    console.log(`    当前状态: ${status.currentStatus}`);
    console.log(`    活动异常: ${status.activeExceptions.length} 个`);
    console.log(`    累计停机: ${status.totalDowntimeMinutes} 分钟`);
  }
}

export async function runAllDemos() {
  console.log('\n' + '='.repeat(60));
  console.log('  生产设备点检 API - 完整演示');
  console.log('='.repeat(60));

  try {
    const data = await createSampleData();
    await demoNormalInspection(data);
    await demoKeyExceptionWithDowntime(data);
    await demoRepeatSubmission(data);
    await demoDashboard();

    console.log('\n\n========================================');
    console.log('所有演示完成 ✓');
    console.log('========================================');
  } catch (error) {
    console.error('演示过程中出错:', error);
    throw error;
  }
}

if (require.main === module) {
  runAllDemos().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
