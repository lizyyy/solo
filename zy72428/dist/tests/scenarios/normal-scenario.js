"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNormalScenario = runNormalScenario;
const data_store_1 = require("../../src/store/data-store");
const workflow_service_1 = require("../../src/services/workflow-service");
const checklist_service_1 = require("../../src/services/checklist-service");
const self_check_service_1 = require("../../src/services/self-check-service");
const test_data_1 = require("../test-data");
function runNormalScenario() {
    console.log('\n' + '='.repeat(60));
    console.log('场景一：正常材料导入测试');
    console.log('='.repeat(60));
    data_store_1.dataStore.clear();
    const workflow = workflow_service_1.workflowService.startWorkflow('normal');
    console.log('\n✅ 工作流已启动');
    console.log(workflow_service_1.workflowService.formatState(workflow));
    console.log('\n📥 第一步：导入曲目别名表和排班记录...');
    const state1 = workflow_service_1.workflowService.step1_ImportAliases(workflow.batchId, (0, test_data_1.getNormalAliases)(), (0, test_data_1.getNormalSchedules)());
    console.log(workflow_service_1.workflowService.formatState(state1));
    console.log('\n📸 第二步：审核课时签到照片...');
    const state2 = workflow_service_1.workflowService.step2_ReviewPhotos(workflow.batchId, (0, test_data_1.getNormalPhotos)());
    console.log(workflow_service_1.workflowService.formatState(state2));
    console.log('\n📋 第三步：更新曲目核对表...');
    const { state: state3, conflicts, pendingLeaveReviews } = workflow_service_1.workflowService.step3_UpdateChecklist(workflow.batchId);
    console.log(workflow_service_1.workflowService.formatState(state3));
    console.log('\n🔍 冲突检测结果：');
    if (conflicts.length === 0) {
        console.log('  ✅ 未发现冲突，所有曲目核对一致');
    }
    else {
        console.log(`  ⚠️  发现 ${conflicts.length} 条冲突：`);
        conflicts.forEach((c, i) => {
            console.log(`     ${i + 1}. ${c.description}`);
        });
    }
    console.log('\n👀 请假复核结果：');
    if (pendingLeaveReviews.length === 0) {
        console.log('  ✅ 没有需要巡演统筹复核的请假记录');
    }
    else {
        console.log(`  ⚠️  有 ${pendingLeaveReviews.length} 条请假记录待复核`);
    }
    console.log('\n📊 导出核对表预览：');
    const exported = checklist_service_1.checklistService.exportChecklist('normal');
    console.table(exported);
    console.log('\n📋 冲突报告：');
    const conflictReport = checklist_service_1.checklistService.getConflictReport();
    if (conflictReport.length === 0) {
        console.log('  ✅ 无冲突记录');
    }
    else {
        console.table(conflictReport.map(r => ({
            冲突ID: r.conflictId.slice(0, 8),
            类型: r.type,
            艺人: r.performerName,
            状态: r.status,
            结论: r.conclusion || '-'
        })));
    }
    console.log('\n📜 审计追踪：');
    const auditLog = data_store_1.dataStore.getAuditLog('checklist-item');
    console.log(`  共 ${auditLog.length} 条审计记录`);
    auditLog.slice(0, 3).forEach((entry, i) => {
        console.log(`  ${i + 1}. [${entry.action}] ${entry.description}`);
    });
    console.log('\n🧪 运行自检：');
    const report = self_check_service_1.selfCheckService.runFullCheck();
    console.log(self_check_service_1.selfCheckService.formatReport(report));
    const canComplete = workflow_service_1.workflowService.canComplete(workflow.batchId);
    console.log(`\n✅ 工作流完成状态：${canComplete.canComplete ? '可以完成' : '未完成 - ' + canComplete.reason}`);
    console.log('\n🎉 正常材料场景测试完成！\n');
    return { success: canComplete.canComplete, conflicts, pendingLeaveReviews };
}
if (require.main === module) {
    runNormalScenario();
}
