import { equipmentService } from '../services/equipmentService';
import { templateService } from '../services/templateService';
import { inspectionService } from '../services/inspectionService';
import { exceptionService } from '../services/exceptionService';
import { 
  EquipmentStatus, CheckType, ItemType, 
  RecheckStatus, MaintenanceStatus, ExceptionStatus
} from '../models';
import moment from 'moment';

const operators = {
  zhangsan: { id: 'user-001', name: '张三' },
  lisi: { id: 'user-002', name: '李四' },
  wangwu: { id: 'user-003', name: '王五' }
};

const today = moment().format('YYYY-MM-DD');

async function createInspectionWithException() {
  const cnc = await equipmentService.create({
    name: '测试设备-FAIL',
    code: `TEST-FAIL-${Date.now()}-${Math.random()}`,
    location: '测试车间',
    type: '测试设备',
    status: EquipmentStatus.RUNNING
  }, operators.zhangsan);

  const template = await templateService.createTemplate({
    equipmentId: cnc.id,
    checkType: CheckType.DAILY,
    name: '失败场景测试模板',
    description: '用于演示各种失败情况'
  }, operators.zhangsan);

  const keyItem = await templateService.addItem({
    templateId: template.id,
    name: '安全门开关',
    itemType: ItemType.KEY,
    standard: '正常闭合',
    method: '功能测试',
    sortOrder: 1
  }, operators.zhangsan);

  const normalItem = await templateService.addItem({
    templateId: template.id,
    name: '指示灯',
    itemType: ItemType.NORMAL,
    standard: '绿色亮',
    method: '目视',
    sortOrder: 2
  }, operators.zhangsan);

  const inspection = await inspectionService.create({
    equipmentId: cnc.id,
    templateId: template.id,
    shift: '早班',
    shiftDate: today
  }, operators.lisi);

  await inspectionService.checkItem(inspection.id, {
    itemId: keyItem.id,
    actualValue: '无法闭合',
    isNormal: false,
    remark: '安全门开关故障'
  }, operators.lisi);

  const exception = await exceptionService.reportException({
    inspectionId: inspection.id,
    description: '安全门开关故障',
    level: 'HIGH'
  }, operators.lisi);

  return { cnc, template, keyItem, normalItem, inspection, exception };
}

async function testCloseWithUnresolvedException() {
  console.log('\n========================================');
  console.log('【失败路径1】异常未解决就尝试关闭点检');
  console.log('========================================\n');

  const { inspection, exception } = await createInspectionWithException();
  console.log('1. 已创建设备、模板、点检、异常记录');
  console.log(`   异常状态: ${exception.status}`);

  console.log('\n2. 尝试直接关闭点检（应该失败）...');
  try {
    await inspectionService.close(inspection.id, operators.lisi);
    console.log('   ✗ 错误：应该失败但成功了！');
    return { success: false, error: '应该报错却没有' };
  } catch (e: any) {
    console.log(`   ✓ 正确拒绝关闭: ${e.code} - ${e.message}`);
    return { success: true, error: e.message, errorCode: e.code };
  }
}

async function testCloseBeforeComplete() {
  console.log('\n\n========================================');
  console.log('【失败路径2】点检未完成就尝试关闭');
  console.log('========================================\n');

  const cnc = await equipmentService.create({
    name: '测试设备-FAIL2',
    code: `TEST-FAIL2-${Date.now()}`,
    location: '测试车间',
    type: '测试设备',
    status: EquipmentStatus.RUNNING
  }, operators.zhangsan);

  const template = await templateService.createTemplate({
    equipmentId: cnc.id,
    checkType: CheckType.DAILY,
    name: '失败场景测试模板2',
    description: '用于演示各种失败情况'
  }, operators.zhangsan);

  console.log('1. 创建点检但不完成...');
  const inspection = await inspectionService.create({
    equipmentId: cnc.id,
    templateId: template.id,
    shift: '中班',
    shiftDate: today
  }, operators.lisi);
  console.log(`   ✓ 点检创建成功，状态: ${inspection.status}`);

  console.log('\n2. 尝试直接关闭（未完成状态）...');
  try {
    await inspectionService.close(inspection.id, operators.lisi);
    console.log('   ✗ 错误：应该失败但成功了！');
    return { success: false, error: '应该报错却没有' };
  } catch (e: any) {
    console.log(`   ✓ 正确拒绝关闭: ${e.code} - ${e.message}`);
    return { success: true, error: e.message, errorCode: e.code };
  }
}

async function testMaintenanceWithoutStart() {
  console.log('\n\n========================================');
  console.log('【失败路径3】维修未开始就尝试完成');
  console.log('========================================\n');

  const { exception } = await createInspectionWithException();
  console.log('1. 已创建点检和异常...');

  console.log('\n2. 派工维修...');
  const maintenance = await exceptionService.assignMaintenance({
    exceptionId: exception.id,
    assigneeId: operators.wangwu.id,
    assigneeName: operators.wangwu.name,
    priority: 'HIGH',
    description: '测试维修'
  }, operators.zhangsan);
  console.log(`   ✓ 维修已派工，状态: ${maintenance.status}`);

  console.log('\n3. 不开始维修直接完成（应该失败）...');
  try {
    await exceptionService.completeMaintenance(maintenance.id, '测试结果', operators.wangwu);
    console.log('   ✗ 错误：应该失败但成功了！');
    return { success: false, error: '应该报错却没有' };
  } catch (e: any) {
    console.log(`   ✓ 正确拒绝: ${e.code} - ${e.message}`);
    return { success: true, error: e.message, errorCode: e.code };
  }
}

async function testRecheckBeforeMaintenanceComplete() {
  console.log('\n\n========================================');
  console.log('【失败路径4】维修未完成就尝试复检');
  console.log('========================================\n');

  const { exception } = await createInspectionWithException();
  console.log('1. 已创建点检和异常...');

  await exceptionService.assignMaintenance({
    exceptionId: exception.id,
    assigneeId: operators.wangwu.id,
    assigneeName: operators.wangwu.name,
    priority: 'HIGH',
    description: '测试维修'
  }, operators.zhangsan);

  const updatedException = await exceptionService.getExceptionById(exception.id);
  console.log(`   ✓ 异常当前状态: ${updatedException?.status}`);

  console.log('\n2. 尝试直接复检（维修未完成）...');
  try {
    await exceptionService.recheck({
      exceptionId: exception.id,
      result: RecheckStatus.PASSED
    }, operators.zhangsan);
    console.log('   ✗ 错误：应该失败但成功了！');
    return { success: false, error: '应该报错却没有' };
  } catch (e: any) {
    console.log(`   ✓ 正确拒绝: ${e.code} - ${e.message}`);
    return { success: true, error: e.message, errorCode: e.code };
  }
}

async function testDuplicateShiftInspection() {
  console.log('\n\n========================================');
  console.log('【失败路径5】同一班次重复点检');
  console.log('========================================\n');

  const cnc = await equipmentService.create({
    name: '测试设备-FAIL5',
    code: `TEST-FAIL5-${Date.now()}`,
    location: '测试车间',
    type: '测试设备',
    status: EquipmentStatus.RUNNING
  }, operators.zhangsan);

  const template = await templateService.createTemplate({
    equipmentId: cnc.id,
    checkType: CheckType.DAILY,
    name: '失败场景测试模板5',
    description: '用于演示重复点检'
  }, operators.zhangsan);

  console.log('1. 第一次创建点检...');
  const inspection1 = await inspectionService.create({
    equipmentId: cnc.id,
    templateId: template.id,
    shift: '早班',
    shiftDate: today
  }, operators.lisi);
  console.log(`   ✓ 第一次点检成功，ID: ${inspection1.id}`);

  console.log('\n2. 同一设备同一班次再次点检（不使用idempotentKey）...');
  try {
    await inspectionService.create({
      equipmentId: cnc.id,
      templateId: template.id,
      shift: '早班',
      shiftDate: today
    }, operators.zhangsan);
    console.log('   ✗ 错误：应该失败但成功了！');
    return { success: false, error: '应该报错却没有' };
  } catch (e: any) {
    console.log(`   ✓ 正确拒绝重复点检: ${e.code} - ${e.message}`);
    return { success: true, error: e.message, errorCode: e.code };
  }
}

export async function runAllFailDemos() {
  console.log('\n' + '='.repeat(60));
  console.log('  生产设备点检 API - 失败路径演示');
  console.log('='.repeat(60));

  const results: any[] = [];

  results.push(await testCloseWithUnresolvedException());
  results.push(await testCloseBeforeComplete());
  results.push(await testMaintenanceWithoutStart());
  results.push(await testRecheckBeforeMaintenanceComplete());
  results.push(await testDuplicateShiftInspection());

  console.log('\n\n========================================');
  console.log('失败路径演示结果汇总');
  console.log('========================================\n');

  results.forEach((r, i) => {
    const status = r.success ? '✓ 按预期失败' : '✗ 未按预期失败';
    console.log(`路径${i + 1}: ${status}`);
    if (r.errorCode) {
      console.log(`       错误码: ${r.errorCode}`);
      console.log(`       错误信息: ${r.error}`);
    }
    console.log('');
  });

  const allPassed = results.every(r => r.success);
  console.log(`\n总结果: ${allPassed ? '✓ 所有失败路径都按预期工作' : '✗ 存在未预期的问题'}`);

  return allPassed;
}

if (require.main === module) {
  runAllFailDemos().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
