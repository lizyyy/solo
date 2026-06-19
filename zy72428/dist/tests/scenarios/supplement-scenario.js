"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSupplementScenario = runSupplementScenario;
const data_store_1 = require("../../src/store/data-store");
const workflow_service_1 = require("../../src/services/workflow-service");
const checklist_service_1 = require("../../src/services/checklist-service");
const self_check_service_1 = require("../../src/services/self-check-service");
const schedule_import_service_1 = require("../../src/services/schedule-import-service");
const test_data_1 = require("../test-data");
function runSupplementScenario() {
    console.log('\n' + '='.repeat(60));
    console.log('场景三：补录材料导入测试');
    console.log('（包含：补录后重算、请假复核、导出一致）');
    console.log('='.repeat(60));
    data_store_1.dataStore.clear();
    console.log('\n📌 先导入基础正常材料...');
    const baseWorkflow = workflow_service_1.workflowService.startWorkflow('normal');
    workflow_service_1.workflowService.step1_ImportAliases(baseWorkflow.batchId, (0, test_data_1.getSupplementAliases)().slice(0, 4), []);
    const workflow = workflow_service_1.workflowService.startWorkflow('supplement');
    console.log('\n✅ 补录工作流已启动');
    console.log('\n📥 第一步：导入补录曲目别名表和排班记录...');
    const state1 = workflow_service_1.workflowService.step1_ImportAliases(workflow.batchId, (0, test_data_1.getSupplementAliases)().slice(4), (0, test_data_1.getSupplementSchedules)());
    console.log(workflow_service_1.workflowService.formatState(state1));
    console.log('\n⚠️  故意设置一个请假课时为已消耗，测试检测能力...');
    const schedules = data_store_1.dataStore.getAllScheduleRecords().filter((s) => s.source === 'supplement');
    const leaveSchedule = schedules.find((s) => s.isLeave);
    if (leaveSchedule) {
        const modified = {
            ...leaveSchedule,
            isConsumed: true,
            consumedHours: 2,
            updatedAt: new Date(),
        };
        data_store_1.dataStore.saveScheduleRecord(modified);
        console.log(`   已设置：${leaveSchedule.performerName} 的请假课时为已消耗（用于测试）`);
    }
    console.log('\n📸 第二步：审核补录的课时签到照片...');
    const state2 = workflow_service_1.workflowService.step2_ReviewPhotos(workflow.batchId, (0, test_data_1.getSupplementPhotos)());
    console.log(workflow_service_1.workflowService.formatState(state2));
    console.log('\n📋 第三步：更新曲目核对表，自动重算补录材料...');
    const { state: state3, conflicts, pendingLeaveReviews } = workflow_service_1.workflowService.step3_UpdateChecklist(workflow.batchId);
    console.log(workflow_service_1.workflowService.formatState(state3));
    console.log('\n🔍 冲突检测结果：');
    if (conflicts.length === 0) {
        console.log('  ✅ 补录材料未发现冲突');
    }
    else {
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
    }
    else {
        console.log(`  ⚠️  有 ${pendingLeaveReviews.length} 条请假记录待巡演统筹复核：`);
        pendingLeaveReviews.forEach((item, i) => {
            console.log(`     ${i + 1}. ${item.performerName} - ${item.sessionDate.toLocaleDateString()}`);
            console.log(`        请假课时被算进已消耗：${item.conflictEvidence?.type === 'leave-counted-as-consumed' ? '是' : '否'}`);
        });
    }
    console.log('\n📊 导出核对表预览：');
    const exported = checklist_service_1.checklistService.exportChecklist('supplement');
    console.table(exported);
    console.log('\n📋 冲突报告（处理前）：');
    const conflictReportBefore = checklist_service_1.checklistService.getConflictReport();
    console.table(conflictReportBefore.map(r => ({
        冲突ID: r.conflictId.slice(0, 8),
        类型: r.type,
        艺人: r.performerName,
        状态: r.status,
        结论: r.conclusion || '-'
    })));
    console.log('\n🧪 运行自检（补录前）：');
    const reportBefore = self_check_service_1.selfCheckService.runFullCheck();
    console.log(self_check_service_1.selfCheckService.formatReport(reportBefore));
    console.log('\n🔄 手动触发补录后重算...');
    const supplementSchedules = data_store_1.dataStore.getAllScheduleRecords().filter((s) => s.source === 'supplement');
    const batchIds = [...new Set(supplementSchedules.map((s) => s.importBatchId))];
    for (const batchId of batchIds) {
        const result = schedule_import_service_1.scheduleImportService.recalculateConsumedHours(batchId);
        if (result.updated.length > 0) {
            console.log(`   ✅ 批次 ${batchId.slice(0, 20)}... 重算了 ${result.updated.length} 条记录`);
            result.messages.forEach((msg) => console.log(`     - ${msg}`));
        }
    }
    console.log('\n🧪 运行自检（重算后）：');
    const reportAfter = self_check_service_1.selfCheckService.runFullCheck();
    console.log(self_check_service_1.selfCheckService.formatReport(reportAfter));
    console.log('\n🔧 自动修复剩余问题...');
    const fixResult = self_check_service_1.selfCheckService.autoFixIssues(reportAfter);
    if (fixResult.fixed.length > 0) {
        console.log(`\n✅ 已自动修复 ${fixResult.fixed.length} 个问题：`);
        fixResult.messages.forEach((msg) => {
            console.log(`   - ${msg}`);
        });
    }
    console.log('\n👑 巡演统筹复核所有请假记录...');
    const allPendingLeave = data_store_1.dataStore
        .getAllChecklistItems()
        .filter((item) => item.isLeave && item.leaveReviewStatus === 'pending');
    for (const item of allPendingLeave) {
        workflow_service_1.workflowService.reviewLeaveByCoordinator(workflow.batchId, item.id, '巡演统筹老李');
        console.log(`   ✅ 已复核：${item.performerName} 的请假记录`);
    }
    const allConflictItems = data_store_1.dataStore
        .getAllChecklistItems()
        .filter((item) => item.verificationResult === 'conflict' && item.conflictId);
    for (const item of allConflictItems) {
        if (item.conflictEvidence?.needsCoordinatorReview) {
            workflow_service_1.workflowService.reviewLeaveByCoordinator(workflow.batchId, item.id, '巡演统筹老李');
            console.log(`   ✅ 统筹已处理冲突项：${item.performerName}（冲突ID: ${item.conflictId?.slice(0, 8)}）`);
        }
        else {
            workflow_service_1.workflowService.resolveConflict(workflow.batchId, item.id, true, '版权运营小鹿');
            console.log(`   ✅ 小鹿已确认：${item.performerName}（冲突ID: ${item.conflictId?.slice(0, 8)}）`);
        }
    }
    console.log('\n📋 冲突报告（处理后）：');
    const conflictReportAfter = checklist_service_1.checklistService.getConflictReport();
    console.table(conflictReportAfter.map(r => ({
        冲突ID: r.conflictId.slice(0, 8),
        类型: r.type,
        艺人: r.performerName,
        状态: r.status,
        处理人: r.handledBy || '-',
        结论: r.conclusion || '-'
    })));
    console.log('\n� 审计追踪（补录相关状态变化）：');
    const auditLog = data_store_1.dataStore.getAuditLog('checklist-item');
    const changeAudits = auditLog.filter((e) => e.action === 'conflict-resolve' || e.action === 'leave-review');
    for (const entry of changeAudits) {
        console.log(`  [${entry.action}] ${entry.description}`);
        if (entry.before) {
            console.log(`    改前：${JSON.stringify(entry.before)}`);
        }
        console.log(`    改后：${JSON.stringify(entry.after)}`);
    }
    console.log('\n✅ 验证导出一致性：');
    const finalReport = self_check_service_1.selfCheckService.runFullCheck();
    const exportCheck = finalReport.items.find((i) => i.checkType === 'export-consistency');
    console.log(`   导出一致性：${exportCheck?.status === 'pass' ? '✅ 通过' : '❌ 失败'}`);
    const canComplete = workflow_service_1.workflowService.canComplete(workflow.batchId);
    console.log(`\n✅ 工作流完成状态：${canComplete.canComplete ? '可以完成' : '未完成 - ' + canComplete.reason}`);
    console.log('\n🧪 最终自检：');
    const lastReport = self_check_service_1.selfCheckService.runFullCheck();
    console.log(self_check_service_1.selfCheckService.formatReport(lastReport));
    console.log('\n📊 最终导出核对表：');
    const finalExport = checklist_service_1.checklistService.exportChecklist();
    console.table(finalExport);
    console.log('\n🎉 补录材料场景测试完成！\n');
    return { success: canComplete.canComplete, conflicts, pendingLeaveReviews };
}
if (require.main === module) {
    runSupplementScenario();
}
