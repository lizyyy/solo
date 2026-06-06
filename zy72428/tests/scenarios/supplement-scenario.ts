import { dataStore } from '../../src/store/data-store';
import { workflowService } from '../../src/services/workflow-service';
import { checklistService } from '../../src/services/checklist-service';
import { selfCheckService } from '../../src/services/self-check-service';
import { scheduleImportService } from '../../src/services/schedule-import-service';
import {
  getSupplementAliases,
  getSupplementSchedules,
  getSupplementPhotos,
} from '../test-data';

export function runSupplementScenario() {
  console.log('\n' + '='.repeat(60));
  console.log('场景三：补录材料导入测试');
  console.log('（包含：补录后重算、请假复核、导出一致）');
  console.log('='.repeat(60));

  dataStore.clear();

  console.log('\n📌 先导入基础正常材料...');
  const baseWorkflow = workflowService.startWorkflow('normal');
  workflowService.step1_ImportAliases(
    baseWorkflow.batchId,
    getSupplementAliases().slice(0, 4),
    []
  );

  const workflow = workflowService.startWorkflow('supplement');
  console.log('\n✅ 补录工作流已启动');

  console.log('\n📥 第一步：导入补录曲目别名表和排班记录...');
  const state1 = workflowService.step1_ImportAliases(
    workflow.batchId,
    getSupplementAliases().slice(4),
    getSupplementSchedules()
  );
  console.log(workflowService.formatState(state1));

  console.log('\n⚠️  故意设置一个请假课时为已消耗，测试检测能力...');
  const schedules = dataStore.getAllScheduleRecords().filter((s) => s.source === 'supplement');
  const leaveSchedule = schedules.find((s) => s.isLeave);
  if (leaveSchedule) {
    const modified = {
      ...leaveSchedule,
      isConsumed: true,
      consumedHours: 2,
      updatedAt: new Date(),
    };
    dataStore.saveScheduleRecord(modified);
    console.log(`   已设置：${leaveSchedule.performerName} 的请假课时为已消耗（用于测试）`);
  }

  console.log('\n📸 第二步：审核补录的课时签到照片...');
  const state2 = workflowService.step2_ReviewPhotos(
    workflow.batchId,
    getSupplementPhotos()
  );
  console.log(workflowService.formatState(state2));

  console.log('\n📋 第三步：更新曲目核对表，自动重算补录材料...');
  const { state: state3, conflicts, pendingLeaveReviews } = workflowService.step3_UpdateChecklist(
    workflow.batchId
  );
  console.log(workflowService.formatState(state3));

  console.log('\n🔍 冲突检测结果：');
  if (conflicts.length === 0) {
    console.log('  ✅ 补录材料未发现冲突');
  } else {
    console.log(`  ⚠️  发现 ${conflicts.length} 条冲突：`);
    conflicts.forEach((c, i) => {
      console.log(`\n     ${i + 1}. ${c.type}`);
      console.log(`        ${c.description}`);
      console.log(`        建议：${c.suggestion}`);
    });
  }

  console.log('\n👀 待巡演统筹复核的请假记录：');
  if (pendingLeaveReviews.length === 0) {
    console.log('  ✅ 没有需要复核的请假记录');
  } else {
    console.log(`  ⚠️  有 ${pendingLeaveReviews.length} 条请假记录待巡演统筹复核：`);
    pendingLeaveReviews.forEach((item, i) => {
      console.log(`     ${i + 1}. ${item.performerName} - ${item.sessionDate.toLocaleDateString()}`);
      console.log(`        请假课时被算进已消耗：${item.conflictEvidence?.type === 'leave-counted-as-consumed' ? '是' : '否'}`);
    });
  }

  console.log('\n📊 导出核对表预览：');
  const exported = checklistService.exportChecklist('supplement');
  console.table(exported);

  console.log('\n🧪 运行自检（补录前）：');
  const reportBefore = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(reportBefore));

  console.log('\n🔄 手动触发补录后重算...');
  const supplementSchedules = dataStore.getAllScheduleRecords().filter((s) => s.source === 'supplement');
  const batchIds = [...new Set(supplementSchedules.map((s) => s.importBatchId))];
  for (const batchId of batchIds) {
    const result = scheduleImportService.recalculateConsumedHours(batchId);
    if (result.updated.length > 0) {
      console.log(`   ✅ 批次 ${batchId.slice(0, 20)}... 重算了 ${result.updated.length} 条记录`);
      result.messages.forEach((msg) => console.log(`     - ${msg}`));
    }
  }

  console.log('\n🧪 运行自检（重算后）：');
  const reportAfter = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(reportAfter));

  console.log('\n🔧 自动修复剩余问题...');
  const fixResult = selfCheckService.autoFixIssues(reportAfter);
  if (fixResult.fixed.length > 0) {
    console.log(`\n✅ 已自动修复 ${fixResult.fixed.length} 个问题：`);
    fixResult.messages.forEach((msg) => {
      console.log(`   - ${msg}`);
    });
  }

  console.log('\n✅ 验证导出一致性：');
  const finalReport = selfCheckService.runFullCheck();
  const exportCheck = finalReport.items.find((i) => i.checkType === 'export-consistency');
  console.log(`   导出一致性：${exportCheck?.status === 'pass' ? '✅ 通过' : '❌ 失败'}`);

  console.log('\n👑 巡演统筹复核所有请假记录：');
  for (const item of pendingLeaveReviews) {
    workflowService.reviewLeaveByCoordinator(workflow.batchId, item.id, '巡演统筹老李');
    console.log(`   ✅ 已复核：${item.performerName} 的请假记录`);
  }

  const canComplete = workflowService.canComplete(workflow.batchId);
  console.log(`\n✅ 工作流完成状态：${canComplete.canComplete ? '可以完成' : '未完成 - ' + canComplete.reason}`);

  console.log('\n🧪 最终自检：');
  const lastReport = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(lastReport));

  console.log('\n📊 最终导出核对表：');
  const finalExport = checklistService.exportChecklist();
  console.table(finalExport);

  console.log('\n🎉 补录材料场景测试完成！\n');
  return { success: canComplete.canComplete, conflicts, pendingLeaveReviews };
}

if (require.main === module) {
  runSupplementScenario();
}
