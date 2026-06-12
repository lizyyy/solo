import { dataStore } from '../../src/store/data-store';
import { workflowService } from '../../src/services/workflow-service';
import { checklistService } from '../../src/services/checklist-service';
import { selfCheckService } from '../../src/services/self-check-service';
import {
  getNormalAliases,
  getNormalSchedules,
  getNormalPhotos,
} from '../test-data';

export function runNormalScenario() {
  console.log('\n' + '='.repeat(60));
  console.log('场景一：正常材料导入测试');
  console.log('='.repeat(60));

  dataStore.clear();

  const workflow = workflowService.startWorkflow('normal');
  console.log('\n✅ 工作流已启动');
  console.log(workflowService.formatState(workflow));

  console.log('\n📥 第一步：导入曲目别名表和排班记录...');
  const state1 = workflowService.step1_ImportAliases(
    workflow.batchId,
    getNormalAliases(),
    getNormalSchedules()
  );
  console.log(workflowService.formatState(state1));

  console.log('\n📸 第二步：审核课时签到照片...');
  const state2 = workflowService.step2_ReviewPhotos(
    workflow.batchId,
    getNormalPhotos()
  );
  console.log(workflowService.formatState(state2));

  console.log('\n📋 第三步：更新曲目核对表...');
  const { state: state3, conflicts, pendingLeaveReviews } = workflowService.step3_UpdateChecklist(
    workflow.batchId
  );
  console.log(workflowService.formatState(state3));

  console.log('\n🔍 冲突检测结果：');
  if (conflicts.length === 0) {
    console.log('  ✅ 未发现冲突，所有曲目核对一致');
  } else {
    console.log(`  ⚠️  发现 ${conflicts.length} 条冲突：`);
    conflicts.forEach((c, i) => {
      console.log(`     ${i + 1}. ${c.description}`);
    });
  }

  console.log('\n👀 请假复核结果：');
  if (pendingLeaveReviews.length === 0) {
    console.log('  ✅ 没有需要巡演统筹复核的请假记录');
  } else {
    console.log(`  ⚠️  有 ${pendingLeaveReviews.length} 条请假记录待复核`);
  }

  console.log('\n📊 导出核对表预览：');
  const exported = checklistService.exportChecklist('normal');
  console.table(exported);

  console.log('\n📋 冲突报告：');
  const conflictReport = checklistService.getConflictReport();
  if (conflictReport.length === 0) {
    console.log('  ✅ 无冲突记录');
  } else {
    console.table(conflictReport.map(r => ({
      冲突ID: r.conflictId.slice(0, 8),
      类型: r.type,
      艺人: r.performerName,
      状态: r.status,
      结论: r.conclusion || '-'
    })));
  }

  console.log('\n📜 审计追踪：');
  const auditLog = dataStore.getAuditLog('checklist-item');
  console.log(`  共 ${auditLog.length} 条审计记录`);
  auditLog.slice(0, 3).forEach((entry, i) => {
    console.log(`  ${i + 1}. [${entry.action}] ${entry.description}`);
  });

  console.log('\n🧪 运行自检：');
  const report = selfCheckService.runFullCheck();
  console.log(selfCheckService.formatReport(report));

  const canComplete = workflowService.canComplete(workflow.batchId);
  console.log(`\n✅ 工作流完成状态：${canComplete.canComplete ? '可以完成' : '未完成 - ' + canComplete.reason}`);

  console.log('\n🎉 正常材料场景测试完成！\n');
  return { success: canComplete.canComplete, conflicts, pendingLeaveReviews };
}

if (require.main === module) {
  runNormalScenario();
}
