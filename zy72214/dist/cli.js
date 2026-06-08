"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dataStore_1 = require("./store/dataStore");
const dailyCutService_1 = require("./services/dailyCutService");
const types_1 = require("./types");
function section(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}
function logJson(label, obj) {
    console.log(`\n【${label}】`);
    console.log(JSON.stringify(obj, null, 2));
}
function main() {
    section('融资融券利息日切 - 真实样例验证');
    console.log('\n>>> 场景一：正常流程（审批人为中文姓名）');
    console.log('    托管确认页导入 → 风控补看除权日截图 → 余额变化表更新');
    const normalRaw = [
        {
            originalRowNumber: 3,
            importBatchId: 'BATCH-20240115-001',
            clientAccount: '6801234567',
            interestAmount: 2350.50,
            approverName: '赵建国',
            approvalDate: '2024-01-15',
            rawContent: '第3行|6801234567|融资利息2350.50|审批人赵建国|2024-01-15'
        },
        {
            originalRowNumber: 7,
            importBatchId: 'BATCH-20240115-001',
            clientAccount: '6807654321',
            interestAmount: 1580.00,
            approverName: '刘明',
            approvalDate: '2024-01-15',
            rawContent: '第7行|6807654321|融券利息1580.00|审批人刘明|2024-01-15'
        }
    ];
    const importResult = dataStore_1.dataStore.importConfirmations(normalRaw, '运营小李');
    logJson('第一步：托管确认页导入结果', importResult);
    const normalConf = dataStore_1.dataStore.getConfirmation(importResult.importedIds[0]);
    console.log(`\n  核对：行号3记录状态 = ${normalConf?.status} (期望 IMPORTED)`);
    console.log(`  核对：审批人 = ${normalConf?.approverName} (期望 赵建国)`);
    console.log(`  核对：isPinyinApprover = ${normalConf?.isPinyinApprover} (期望 false)`);
    const exRightsReview = dailyCutService_1.dailyCutService.reviewExRightsDate(importResult.importedIds[0], '风控老秦', 'ex_rights_screenshot_20240115_003.png', true, '2024-01-12', '600519贵州茅台分红除权，每股派息21.91元，利息调整-200', -200);
    logJson('第二步：风控补看除权日截图', {
        审查人: exRightsReview?.reviewedBy,
        有除权事件: exRightsReview?.hasExRightsEvent,
        除权日: exRightsReview?.exRightsDate,
        影响说明: exRightsReview?.impactDescription,
        调整金额: exRightsReview?.adjustmentAmount
    });
    const afterExRights = dataStore_1.dataStore.getConfirmation(importResult.importedIds[0]);
    console.log(`\n  核对：行号3状态 = ${afterExRights?.status} (期望 EX_RIGHTS_DATE_REVIEWED)`);
    const balanceChange = dailyCutService_1.dailyCutService.updateBalance(importResult.importedIds[0], '结算小王', 100000, '2024-01-16');
    logJson('第三步：余额变化表更新', {
        原余额: balanceChange?.previousBalance,
        利息: balanceChange?.interestAmount,
        除权调整: balanceChange?.adjustmentAmount,
        新余额: balanceChange?.newBalance,
        生效日: balanceChange?.effectiveDate
    });
    const afterBalance = dataStore_1.dataStore.getConfirmation(importResult.importedIds[0]);
    console.log(`\n  核对：行号3最终状态 = ${afterBalance?.status} (期望 BALANCE_UPDATED)`);
    console.log(`  核对：新余额 = ${balanceChange?.newBalance} (期望 102150.50 = 100000 + 2350.50 - 200)`);
    section('场景二：审批人只留拼音 → 卡住待复核');
    const pinyinRaw = [
        {
            originalRowNumber: 12,
            importBatchId: 'BATCH-20240115-001',
            clientAccount: '6809998888',
            interestAmount: 4200.00,
            approverName: 'zhang wei',
            approvalDate: '2024-01-15',
            rawContent: '第12行|6809998888|融资利息4200.00|审批人zhang wei|2024-01-15'
        }
    ];
    const pinyinResult = dataStore_1.dataStore.importConfirmations(pinyinRaw, '运营小李');
    logJson('拼音审批人导入结果', pinyinResult);
    const pinyinConf = dataStore_1.dataStore.getConfirmation(pinyinResult.importedIds[0]);
    console.log(`\n  核对：行号12状态 = ${pinyinConf?.status} (期望 PENDING_APPROVER_VERIFICATION)`);
    console.log(`  核对：isPinyinApprover = ${pinyinConf?.isPinyinApprover} (期望 true)`);
    console.log(`  核对：currentAssignee = ${pinyinConf?.currentAssignee} (期望 客户经理)`);
    const blockedWorkflow = dailyCutService_1.dailyCutService.processFullWorkflow(pinyinResult.importedIds[0], '风控老秦', 'screenshot_012.png', false, null, '无除权事件', 50000, '2024-01-16');
    logJson('尝试直接走完流程（应该被阻断）', {
        已完成: blockedWorkflow.completed,
        除权审查: blockedWorkflow.exRightsReview,
        余额更新: blockedWorkflow.balanceChange
    });
    console.log('\n  → 拼音审批人必须等客户经理复核！');
    section('场景三：客户经理复核审批人拼音后继续流程');
    const verifyOk = dataStore_1.dataStore.verifyApproverName(pinyinResult.importedIds[0], '张伟', '客户经理小赵');
    console.log(`  复核结果：${verifyOk ? '成功' : '失败'}`);
    const afterVerify = dataStore_1.dataStore.getConfirmation(pinyinResult.importedIds[0]);
    console.log(`  核对：审批人 = ${afterVerify?.approverName} (期望 张伟)`);
    console.log(`  核对：状态 = ${afterVerify?.status} (期望 APPROVER_VERIFIED)`);
    console.log(`  核对：isPinyinApprover = ${afterVerify?.isPinyinApprover} (期望 false)`);
    const continueExRights = dailyCutService_1.dailyCutService.reviewExRightsDate(pinyinResult.importedIds[0], '风控老秦', 'ex_rights_screenshot_20240115_012.png', false, null, '无除权事件', 0);
    logJson('复核后继续：除权日审查', { 审查通过: !!continueExRights });
    const continueBalance = dailyCutService_1.dailyCutService.updateBalance(pinyinResult.importedIds[0], '结算小王', 80000, '2024-01-16');
    logJson('复核后继续：余额更新', {
        新余额: continueBalance?.newBalance,
        计算: '80000 + 4200 + 0 = 84200'
    });
    section('场景四：重复导入验证（不应翻倍）');
    const reImportResult = dataStore_1.dataStore.importConfirmations(normalRaw, '运营小李');
    logJson('重复导入同一批数据', reImportResult);
    console.log(`  核对：成功 = ${reImportResult.successCount} (期望 0)`);
    console.log(`  核对：重复 = ${reImportResult.duplicateCount} (期望 2)`);
    console.log(`  核对：总确认页数量 = ${dataStore_1.dataStore.getAllConfirmations().length} (期望 3)`);
    section('场景五：风控老秦改备注 → 历史可查改前改后');
    dataStore_1.dataStore.updateRemark(importResult.importedIds[0], '客户已电话确认利息金额，贵州茅台分红影响已沟通', '风控老秦', '电话回访后补充');
    const confWithRemark = dataStore_1.dataStore.getConfirmation(importResult.importedIds[0]);
    logJson('备注修改后的人工改动记录', confWithRemark?.manualModifications);
    section('场景六：证据链查询（客户经理追问时）');
    const evidence = dailyCutService_1.dailyCutService.getEvidenceForCustomerManager(importResult.importedIds[0]);
    logJson('完整证据链', {
        原始行号: evidence?.originalRowNumber,
        原始内容: evidence?.rawContent,
        当前状态: evidence?.status,
        人工改动数: evidence?.manualModifications.length,
        状态流转: evidence?.statusFlow.map((f) => `${f.status} ← ${f.operator} (${f.time})`),
        除权审查: evidence?.exRightsReview ? {
            截图: evidence.exRightsReview.screenshotReference,
            有除权: evidence.exRightsReview.hasExRightsEvent,
            调整: evidence.exRightsReview.adjustmentAmount
        } : null,
        余额变化: evidence?.balanceChange ? {
            原余额: evidence.balanceChange.previousBalance,
            新余额: evidence.balanceChange.newBalance,
            利息: evidence.balanceChange.interestAmount,
            调整: evidence.balanceChange.adjustmentAmount
        } : null
    });
    section('场景七：回滚 → 错口径返工');
    const rollbackResult = dataStore_1.dataStore.rollbackToStatus(importResult.importedIds[0], types_1.ProcessingStatus.IMPORTED, '风控老秦', '利息口径错误，需按新公式重新计算');
    logJson('回滚结果', rollbackResult);
    const afterRollback = dataStore_1.dataStore.getConfirmation(importResult.importedIds[0]);
    console.log(`  核对：回滚后状态 = ${afterRollback?.status} (期望 IMPORTED)`);
    console.log(`  核对：exRightsDateReviewId = ${afterRollback?.exRightsDateReviewId} (期望 null)`);
    console.log(`  核对：balanceUpdateId = ${afterRollback?.balanceUpdateId} (期望 null)`);
    section('统计汇总');
    const stats = dailyCutService_1.dailyCutService.getStatistics();
    logJson('系统统计', stats);
    section('验证完成');
    console.log('\n✅ 全部场景走完，核对项：');
    console.log('  1. 正常流程三步状态递进正确');
    console.log('  2. 拼音审批人自动卡住，复核后才能继续');
    console.log('  3. 重复导入不翻倍');
    console.log('  4. 备注修改留痕（改前/改后/操作人/原因）');
    console.log('  5. 证据链可查原始行号、原始内容、改动记录、除权审查、余额变化');
    console.log('  6. 回滚清理关联数据（除权审查、余额更新被删除）');
    console.log('  7. 统计汇总各状态数量正确\n');
}
main();
