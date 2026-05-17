import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { AppealService } from '../services/AppealService';
import { format } from 'date-fns';
import * as crypto from 'crypto';

async function runAcceptanceTest() {
  await AppDataSource.initialize();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║              SaaS账单中心套餐超额冻结申诉系统验收测试      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const appealService = new AppealService();
  let allPassed = true;

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 1: 完整流转 (APPEAL_001 - 北京科技有限公司)       │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const appealList = await appealService.getAppealList({ appealCode: 'APPEAL_001' }, 1, 10);
  const appeal1 = appealList.data[0];

  if (appeal1 && appeal1.appealCode === 'APPEAL_001') {
    console.log('  ✓ 列表查询成功');
    console.log(`    - 申诉编号: ${appeal1.appealCode}`);
    console.log(`    - 申诉状态: ${appeal1.status}`);
    console.log(`    - 租户名称: ${appeal1.tenant?.tenantName}`);
    console.log(`    - 租户状态: ${appeal1.tenant?.status}`);
    console.log(`    - 负责人: ${appeal1.tenant?.responsiblePerson}`);
    console.log(`    - 业务对象: ${appeal1.tenant?.businessObject}`);
  } else {
    console.log('  ✗ 列表查询失败');
    allPassed = false;
  }

  const detail = await appealService.getAppealDetail(appeal1.id);
  if (detail.histories && detail.histories.length > 0) {
    console.log('\n  ✓ 详情查询成功，包含完整历史记录');
    console.log(`    - 历史记录数: ${detail.histories.length} 条`);
    console.log('    - 流转过程:');
    detail.histories.forEach((h: any, i: number) => {
      const dupMark = h.isDuplicateSubmission ? ' [重复提交]' : '';
      console.log(`      ${i + 1}. ${format(new Date(h.operatedAt), 'MM-dd HH:mm')} - ${h.operatorName}: ${h.operationRemark}${dupMark}`);
    });
  } else {
    console.log('\n  ✗ 详情查询失败');
    allPassed = false;
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 2: 冲突记录 (重复点击、异步回调)                  │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const duplicateHistories = detail.histories.filter((h: any) => h.isDuplicateSubmission);
  if (duplicateHistories.length >= 3) {
    console.log('  ✓ 检测到重复提交记录');
    console.log(`    - 重复提交数: ${duplicateHistories.length} 条`);
    duplicateHistories.forEach((h: any, i: number) => {
      console.log(`      ${i + 1}. ${h.operatorName}: ${h.operationRemark}`);
    });
  } else {
    console.log('  ✗ 未检测到重复提交记录');
    allPassed = false;
  }

  const requestId1 = 'test_req_' + crypto.randomUUID().substring(0, 8);
  const requestId2 = 'test_req_' + crypto.randomUUID().substring(0, 8);
  const requestId3 = 'test_req_' + crypto.randomUUID().substring(0, 8);

  console.log('\n  测试防重复提交机制:');
  const result1 = await appealService.submitRestorationRequest(appeal1.id, '测试用户', requestId1);
  console.log(`    第1次提交: ${result1.message} (isDuplicate=${result1.isDuplicate})`);

  const result2 = await appealService.submitRestorationRequest(appeal1.id, '测试用户', requestId2);
  console.log(`    第2次提交: ${result2.message} (isDuplicate=${result2.isDuplicate})`);

  const result3 = await appealService.submitRestorationRequest(appeal1.id, '测试用户', requestId3);
  console.log(`    第3次提交: ${result3.message} (isDuplicate=${result3.isDuplicate})`);

  if (result1.isDuplicate === false && result2.isDuplicate === true && result3.isDuplicate === true) {
    console.log('  ✓ 防重复提交机制正常工作');
  } else {
    console.log('  ✗ 防重复提交机制异常');
    allPassed = false;
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 3: 导入坏行 (APPEAL_BAD_001)                      │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const listWithoutBad = await appealService.getAppealList({}, 1, 100);
  const listWithBad = await appealService.getAppealList({ includeBadRecords: true }, 1, 100);

  console.log(`  默认不包含坏行: ${listWithoutBad.data.length} 条`);
  console.log(`  包含坏行时: ${listWithBad.data.length} 条`);

  const badRecord = listWithBad.data.find(a => a.isBadRecord);
  if (badRecord) {
    console.log('  ✓ 检测到坏行记录');
    console.log(`    - 坏行编号: ${badRecord.appealCode}`);
    console.log(`    - 坏行原因: ${badRecord.badRecordReason}`);
    console.log(`    - 提交人: '${badRecord.submitterName}'`);
    console.log(`    - 申诉原因: '${badRecord.reason}'`);
  } else {
    console.log('  ✗ 未检测到坏行记录');
    allPassed = false;
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 4: 列表筛选功能                                   │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const filterTests = [
    { name: '按状态筛选(completed)', filter: { status: 'completed' }, expectedMin: 1 },
    { name: '按负责人筛选(王经理)', filter: { responsiblePerson: '王经理' }, expectedMin: 1 },
    { name: '按业务对象筛选(电商平台)', filter: { businessObject: '电商平台' }, expectedMin: 1 },
    { name: '按租户名称筛选(上海)', filter: { tenantName: '上海' }, expectedMin: 1 },
  ];

  for (const test of filterTests) {
    const result = await appealService.getAppealList(test.filter, 1, 100);
    if (result.data.length >= test.expectedMin) {
      console.log(`  ✓ ${test.name}: ${result.data.length} 条`);
    } else {
      console.log(`  ✗ ${test.name}: 期望至少 ${test.expectedMin} 条，实际 ${result.data.length} 条`);
      allPassed = false;
    }
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 5: 导出功能（口径一致性）                          │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const csv = await appealService.exportToCSV({ includeBadRecords: true });
  const lines = csv.trim().split('\n');
  if (lines.length === listWithBad.data.length + 1) {
    console.log(`  ✓ CSV 导出口径一致`);
    console.log(`    - 表头行: 1 行`);
    console.log(`    - 数据行: ${lines.length - 1} 行`);
    console.log(`    - 列表记录数: ${listWithBad.data.length} 条`);
  } else {
    console.log(`  ✗ CSV 导出口径不一致`);
    console.log(`    - 导出行数: ${lines.length - 1}`);
    console.log(`    - 列表记录数: ${listWithBad.data.length}`);
    allPassed = false;
  }

  const headers = lines[0].split(',').map((h: string) => h.replace(/"/g, ''));
  const expectedHeaders = ['申诉编号', '申诉类型', '申诉状态', '租户名称', '租户编号', '租户状态', '负责人', '业务对象'];
  const hasAllHeaders = expectedHeaders.every(h => headers.includes(h));
  if (hasAllHeaders) {
    console.log(`  ✓ 导出字段完整，包含: ${expectedHeaders.join(', ')}`);
  } else {
    console.log(`  ✗ 导出字段缺失`);
    allPassed = false;
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│ 验收场景 6: 统计概览                                       │');
  console.log('└─────────────────────────────────────────────────────────────┘');

  const stats = await appealService.getStatistics();
  console.log(`  申诉状态分布: ${stats.appealByStatus.length} 种状态`);
  console.log(`  租户状态分布: ${stats.tenantByStatus.length} 种状态`);
  console.log(`  重复提交总数: ${stats.totalDuplicateSubmissions} 次`);
  console.log(`  坏行记录数: ${stats.totalBadRecords} 条`);

  if (stats.totalDuplicateSubmissions > 0 && stats.totalBadRecords > 0) {
    console.log('  ✓ 统计数据完整');
  } else {
    console.log('  ✗ 统计数据缺失');
    allPassed = false;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║                    ✅ 验收全部通过!                         ║');
  } else {
    console.log('║                    ❌ 存在验收不通过项!                     ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝');

  await AppDataSource.destroy();
}

runAcceptanceTest().catch(console.error);
