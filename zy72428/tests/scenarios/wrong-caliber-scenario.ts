import { dataStore } from '../../src/store/data-store';
import { workflowService } from '../../src/services/workflow-service';
import { checklistService } from '../../src/services/checklist-service';
import { selfCheckService } from '../../src/services/self-check-service';
import {
  getWrongCaliberAliases,
  getWrongCaliberSchedules,
  getWrongCaliberPhotos,
} from '../test-data';

export function runWrongCaliberScenario() {
  console.log('\n' + '='.repeat(60));
  console.log('场景二：错口径材料导入测试');
  console.log('（包含：重复导入、请假课时误算、曲目不匹配）');
  console.log('='.repeat(60));

  dataStore.clear();

  const workflow = workflowService.startWorkflow('wrong-caliber');
  console.log('\n✅ 工作流已启动');

  console.log('\n📥 第一步：导入曲目别名表和排班记录（含错误数据）...');
  const state1 = workflowService.step1_ImportAliases(
    workflow.batchId,
    getWrongCaliberAliases(),
    getWrongCaliberSchedules()
  );
  console.log(workflowService.formatState(state1));

  console.log('\n📸 第二步：审核课时签到照片（含请假和未知曲目）...');
  const state2 = workflowService.step2_ReviewPhotos(
    workflow.batchId,
    getWrongCaliberPhotos()
  );
  console.log(workflowService.formatState(state2));

  console.log('\n📋 第三步：更新曲目核对表，检测冲突...');
  const { state: state3, conflicts, pendingLeaveReviews } = workflowService.step3_UpdateChecklist(
    workflow.batchId
  );
  console.log(workflowService.formatState(state3));

  console.log('\n🔍 冲突检测结果：');
  if (conflicts.length === 0) {
    console.log('  ✅ 未发现冲突');
  } else {
    console.log(`  ⚠️  发现 ${conflicts.length} 条冲突：`);
    conflicts.forEach((c, i) => {
      console.log(`\n     ${i + 1}. 冲突类型：${c.type}`);
      console.log(`        描述：${c.description}`);
      console.log(`        照片证据：曲目"${c.photoEvidence.trackName}"，请假：${c.photoEvidence.isLeave ? '是' : '否'}`);
      console.log(`        别名表证据：标准名"${c.aliasEvidence.canonicalName}"，版权方：${c.aliasEvidence.copyrightHolder}`);
      if (c.scheduleEvidence) {
        console.log(`        排班证据：已消耗：${c.scheduleEvidence.isConsumed ? '是' : '否'}，消耗${c.scheduleEvidence.consumedHours}课时，请假：${c.scheduleEvidence.isLeave ? '是' : '否'}`);
      }
      console.log(`        建议：${c.suggestion}`);
      console.log(`        需要统筹复核：${c.needsCoordinatorReview ? '是' : '否'}`);
    });
  }

  console.log('\n👀 待巡演统筹复核的请假记录：');
  if (pendingLeaveReviews.length === 0) {
    console.log('  ✅ 没有需要复核的请假记录');
  } else {
    console.log(`  ⚠️  有 ${pendingLeaveReviews.length} 条请假记录待巡演统筹复核：`);
    pendingLeaveReviews.forEach((item, i) => {
      console.log(`     ${i + 1}. ${item.performerName} - ${item.sessionDate.toLocaleDateString()} - ${item.locationName}`);
      console.log(`        曲目：${item.trackNameFromPhoto}`);
      console.log(`        状态：待巡演统筹复核，请勿直接归为正常课时`);
    });
  }

  console.log('\n📊 导出核对表预览：');
  const exported = checklistService.exportChecklist('wrong-caliber');
  console.table(exported);

  console.log('\n🧪 运行自检：');
  const report = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(report));

  console.log('\n🔧 自动修复可修复的问题...');
  const fixResult = selfCheckService.autoFixIssues(report);
  if (fixResult.fixed.length > 0) {
    console.log(`\n✅ 已自动修复 ${fixResult.fixed.length} 个问题：`);
    fixResult.messages.forEach((msg) => {
      console.log(`   - ${msg}`);
    });
  } else {
    console.log('\nℹ️  没有可自动修复的问题');
  }

  console.log('\n📋 冲突报告（处理前）：');
  const conflictReportBefore = checklistService.getConflictReport();
  console.table(conflictReportBefore.map(r => ({
    冲突ID: r.conflictId.slice(0, 8),
    类型: r.type,
    艺人: r.performerName,
    状态: r.status,
    结论: r.conclusion || '-'
  })));

  console.log('\n🤝 模拟版权运营小鹿确认冲突（非统筹复核类）...');
  const checklistItems = dataStore.getAllChecklistItems();
  const conflictItems = checklistItems.filter(
    (item) => item.verificationResult === 'conflict' && item.conflictId
  );

  const nonCoordinatorConflicts = conflictItems.filter(
    (item) => !item.conflictEvidence?.needsCoordinatorReview
  );

  for (const item of nonCoordinatorConflicts) {
    workflowService.resolveConflict(workflow.batchId, item.id, true, '版权运营小鹿');
    console.log(`   ✅ 小鹿已确认：${item.performerName} 的曲目冲突（冲突ID: ${item.conflictId?.slice(0, 8)}）`);
  }

  console.log('\n👑 模拟巡演统筹复核请假记录...');
  const coordinatorConflicts = conflictItems.filter(
    (item) => item.conflictEvidence?.needsCoordinatorReview
  );

  for (const item of coordinatorConflicts) {
    workflowService.reviewLeaveByCoordinator(workflow.batchId, item.id, '巡演统筹老王');
    console.log(`   ✅ 统筹已复核：${item.performerName} 的请假记录（冲突ID: ${item.conflictId?.slice(0, 8)}）`);
  }

  const pendingLeaveStill = dataStore
    .getAllChecklistItems()
    .filter((item) => item.isLeave && item.leaveReviewStatus === 'pending');
  for (const item of pendingLeaveStill) {
    workflowService.reviewLeaveByCoordinator(workflow.batchId, item.id, '巡演统筹老王');
    console.log(`   ✅ 统筹已复核：${item.performerName} 的请假记录`);
  }

  console.log('\n📋 冲突报告（处理后）：');
  const conflictReportAfter = checklistService.getConflictReport();
  console.table(conflictReportAfter.map(r => ({
    冲突ID: r.conflictId.slice(0, 8),
    类型: r.type,
    艺人: r.performerName,
    状态: r.status,
    处理人: r.handledBy || '-',
    结论: r.conclusion || '-'
  })));

  console.log('\n📜 审计追踪（状态变化）：');
  const auditLog = dataStore.getAuditLog('checklist-item');
  const changeAudits = auditLog.filter((e) => e.action === 'conflict-resolve' || e.action === 'leave-review');
  for (const entry of changeAudits) {
    console.log(`  [${entry.action}] ${entry.description}`);
    if (entry.before) {
      console.log(`    改前：${JSON.stringify(entry.before)}`);
    }
    console.log(`    改后：${JSON.stringify(entry.after)}`);
  }

  const finalState = workflowService.getState(workflow.batchId);
  console.log('\n' + workflowService.formatState(finalState));

  const canComplete = workflowService.canComplete(workflow.batchId);
  console.log(`\n✅ 工作流完成状态：${canComplete.canComplete ? '可以完成' : '未完成 - ' + canComplete.reason}`);

  console.log('\n🔄 修复后重新自检：');
  const newReport = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(newReport));

  console.log('\n🎉 错口径材料场景测试完成！\n');
  return { success: canComplete.canComplete, conflicts, pendingLeaveReviews };
}

if (require.main === module) {
  runWrongCaliberScenario();
}
