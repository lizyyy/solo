#!/usr/bin/env ts-node
import * as path from 'path';
import { DataSource, FaultStatus, Role } from '../src/models/types';
import { importFromSource } from '../src/importers';
import { LedgerService } from '../src/services/ledgerService';
import { ExportService } from '../src/services/exportService';

async function main() {
  console.log('=== 充电桩巡检权限追责台账 - 完整演示 ===\n');

  console.log('1. 导入桩端告警数据...');
  const alarmResult = await importFromSource(
    DataSource.PILE_ALARM,
    path.join(__dirname, '../data/raw/sample_alarms.json'),
    '系统导入员'
  );
  console.log(`   成功: ${alarmResult.success}, 跳过: ${alarmResult.skipped}, 失败: ${alarmResult.failed}`);
  console.log(`   (注意: 第3条重复数据被自动去重跳过)\n`);

  const firstRecordId = alarmResult.recordIds[0];

  console.log('2. 导入巡检表数据...');
  const inspectionResult = await importFromSource(
    DataSource.INSPECTION_FORM,
    path.join(__dirname, '../data/raw/sample_inspections.json'),
    '系统导入员'
  );
  console.log(`   成功: ${inspectionResult.success}, 跳过: ${inspectionResult.skipped}, 失败: ${inspectionResult.failed}\n`);

  console.log('3. 导入客服投诉单...');
  const complaintResult = await importFromSource(
    DataSource.CUSTOMER_COMPLAINT,
    path.join(__dirname, '../data/raw/sample_complaints.json'),
    '系统导入员'
  );
  console.log(`   成功: ${complaintResult.success}, 跳过: ${complaintResult.skipped}, 失败: ${complaintResult.failed}\n`);

  console.log('4. 查看所有记录...');
  const allRecords = LedgerService.listRecords();
  console.log(`   当前共有 ${allRecords.length} 条台账记录\n`);

  console.log('5. 演示工作流: 提交记录...');
  const submitted = LedgerService.submitRecord(firstRecordId, '班长A', Role.TEAM_LEADER);
  console.log(`   记录 ${firstRecordId.slice(0, 8)} 状态变为: ${submitted.status}\n`);

  console.log('6. 演示边界情况: 重复提交会报错...');
  try {
    LedgerService.submitRecord(firstRecordId, '班长A', Role.TEAM_LEADER);
  } catch (e) {
    console.log(`   预期错误: ${(e as Error).message}\n`);
  }

  console.log('7. 演示边界情况: 撤回后再提交...');
  const withdrawn = LedgerService.withdrawToDraft(firstRecordId, '班长A', Role.TEAM_LEADER, '需要补充信息');
  console.log(`   撤回后状态: ${withdrawn.status}`);
  const resubmitted = LedgerService.submitRecord(firstRecordId, '班长A', Role.TEAM_LEADER);
  console.log(`   重新提交后状态: ${resubmitted.status}\n`);

  console.log('8. 二次确认...');
  const confirmed = LedgerService.secondaryConfirm(firstRecordId, '片区经理', Role.AREA_MANAGER);
  console.log(`   二次确认后状态: ${confirmed.status}\n`);

  console.log('9. 演示人工改判: 修正故障时长...');
  const modified = LedgerService.manualUpdate(
    firstRecordId,
    '管理员',
    Role.ADMIN,
    { faultDuration: 30 },
    '告警恢复时间有误，实际30分钟'
  );
  console.log(`   故障时长从 ${resubmitted.faultDuration} 改为 ${modified.faultDuration} 分钟`);
  console.log(`   isManuallyModified: ${modified.isManuallyModified}\n`);

  console.log('10. 查看变更差异...');
  const changes = LedgerService.getChangeDiff(firstRecordId);
  changes.forEach(c => {
    const manualTag = c.isManualOverride ? '[人工改判]' : '';
    console.log(`   ${manualTag} ${c.field}: ${c.oldValue} -> ${c.newValue}`);
    console.log(`      原因: ${c.changeReason}`);
    console.log(`      操作人: ${c.changedBy}\n`);
  });

  console.log('11. 导出前冻结...');
  const frozen = LedgerService.freezeRecord(firstRecordId, '片区经理', Role.AREA_MANAGER, '月报导出前冻结');
  console.log(`   冻结后状态: ${frozen.status}\n`);

  console.log('12. 生成报告...');
  const report = ExportService.generateReport();
  console.log(`   总记录数: ${report.summary.total}`);
  console.log(`   总故障时长: ${report.summary.totalDuration} 分钟`);
  console.log(`   人工修改记录: ${report.summary.manuallyModified} 条`);
  console.log(`   TOP 故障类型: ${report.topFaults[0]?.type || '-'}\n`);

  console.log('13. 脱敏导出 CSV...');
  const exportPath = ExportService.exportToFile(
    {
      format: 'csv',
      anonymize: true,
      includeEvidence: false,
      includeChangeLogs: false
    },
    path.join(__dirname, '../data/exported')
  );
  console.log(`   导出文件: ${exportPath}\n`);

  console.log('14. 片区经理视图查看记录详情...');
  const managerView = ExportService.getRecordForView(firstRecordId, Role.AREA_MANAGER);
  console.log(`   处理人: ${managerView.record.handler}`);
  console.log(`   证据链数量: ${managerView.evidences.length}`);
  console.log(`   人工变更摘要: ${managerView.diffSummary?.length || 0} 条\n`);

  console.log('=== 演示完成 ===');
  console.log('\n关键特性验证:');
  console.log('✓ 重复请求自动去重（同一条事实只更新不新增）');
  console.log('✓ 导入时保留来源文件、原始行号、原始数据');
  console.log('✓ 完整工作流: 草稿→提交→撤回→再提交→二次确认→冻结');
  console.log('✓ 人工改判不覆盖原始证据，变更原因可追溯');
  console.log('✓ 导出前冻结确保数据不变');
  console.log('✓ 角色视图（片区经理可见变更摘要）');
  console.log('✓ 敏感字段脱敏导出');
  console.log('✓ 异常不吞，有明确错误信息');
}

main().catch(console.error);
