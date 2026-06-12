"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const tunerMessages = [
    '小明,2026-06-01,14:00,李老师,陪练,45',
    '小红,2026-06-01,15:00,王老师,陪练,45',
    '小花,2026-06-02,10:00,张老师,陪练,60'
];
const groupSignups = [
    '小明,2026-06-01,15:00,李老师,现场到',
    '小红,2026-06-01,15:00,王老师,现场到',
    '小刚,2026-06-01,16:00,赵老师,临时替补,现场到',
    '小花,2026-06-02,10:00,张老师,现场到'
];
function sep(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
}
function runE2E() {
    console.log('\n琴行陪练套餐消课 —— 端到端复现测试\n');
    sep('第一步：调音师留言第一次导入');
    const { records: step1Records, workflow: step1Workflow, reuseReport: step1Reuse } = (0, index_1.step1ImportTunerMessages)(tunerMessages, '调音师小王');
    console.log(`\n导入条数: ${step1Records.length}`);
    console.log(`复用: ${step1Reuse.reused}  真新增: ${step1Reuse.newlyAdded}`);
    console.log();
    step1Records.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.status}] ${r.studentName} ${r.courseDate} ${r.courseTime} ${r.teacherName}`);
        console.log(`     调音师行号: ${r.tunerOriginalLineNumber}  原始内容: "${r.tunerRawContent}"`);
        console.log(`     来源: ${r.importSource}`);
    });
    sep('第二步：版权运营小鹿补看排练群接龙');
    const { records: step2Records, workflow: step2Workflow } = (0, index_1.step2ReviewGroupSignup)(groupSignups, '版权运营小鹿', step1Workflow);
    console.log(`\n合并后总条数: ${step2Records.length}`);
    console.log();
    step2Records.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.status}|${r.reviewFlag}] ${r.studentName} ${r.courseDate} ${r.courseTime} ${r.teacherName}`);
        if (r.tunerRawContent) {
            console.log(`     调音师留言: "${r.tunerRawContent}" (行号${r.tunerOriginalLineNumber})`);
        }
        if (r.groupRawContent) {
            console.log(`     群接龙:     "${r.groupRawContent}" (行号${r.groupOriginalLineNumber})`);
        }
        if (r.groupCourseTime && r.groupCourseTime !== r.courseTime) {
            console.log(`     >>> 口径不一致: 调音师${r.courseTime} vs 群接龙${r.groupCourseTime}`);
        }
        if (r.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
            console.log(`     >>> 临时替补仅在群里说了一句，调音师留言未提及，不自动归正常`);
        }
        console.log();
    });
    sep('自检报告');
    const pageResult = index_1.unifiedStore.getForPageDisplay();
    console.log(`\n总记录: ${pageResult.summary.total}`);
    console.log(`自检问题: ${pageResult.selfCheck.issues.length}`);
    pageResult.selfCheck.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}|${issue.type}] ${issue.message}`);
        if (issue.details) {
            if (issue.details.tunerRawContent) {
                console.log(`     调音师原文: "${issue.details.tunerRawContent}"`);
            }
            if (issue.details.groupRawContent) {
                console.log(`     群接龙原文: "${issue.details.groupRawContent}"`);
            }
        }
    });
    sep('关键记录逐条核对');
    const xiaoMingRecord = step2Records.find(r => r.studentName === '小明' && r.courseDate === '2026-06-01');
    if (xiaoMingRecord) {
        console.log('\n--- 小明 2026-06-01 ---');
        console.log(`状态: ${xiaoMingRecord.status}`);
        console.log(`复核标记: ${xiaoMingRecord.reviewFlag}`);
        console.log(`调音师记录时间: ${xiaoMingRecord.courseTime}`);
        console.log(`群接龙记录时间: ${xiaoMingRecord.groupCourseTime}`);
        if (xiaoMingRecord.reviewFlag === index_1.ReviewFlag.MISMATCH) {
            console.log(`>>> 正确: 口径不一致被标记为需复核，没有自动归匹配`);
        }
        else {
            console.log(`!!! 错误: 口径不一致应标记为需复核，当前是 ${xiaoMingRecord.reviewFlag}`);
        }
        const evidence = index_1.unifiedStore.getRecordEvidence(xiaoMingRecord.id);
        console.log(`证据追溯:`);
        console.log(`  调音师留言: 行号${evidence.evidence.tunerMessage?.originalLineNumber} → "${evidence.evidence.tunerMessage?.rawContent}"`);
        console.log(`  群接龙:     行号${evidence.evidence.groupSignup?.originalLineNumber} → "${evidence.evidence.groupSignup?.rawContent}"`);
        console.log(`  口径不一致: ${evidence.evidence.mismatchDetail || '无'}`);
    }
    const xiaoGangRecord = step2Records.find(r => r.studentName === '小刚');
    if (xiaoGangRecord) {
        console.log('\n--- 小刚 (临时替补仅在群里说了一句) ---');
        console.log(`状态: ${xiaoGangRecord.status}`);
        console.log(`复核标记: ${xiaoGangRecord.reviewFlag}`);
        if (xiaoGangRecord.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
            console.log(`>>> 正确: 临时替补没被自动归正常，留给票务同事复核`);
        }
        else {
            console.log(`!!! 错误: 临时替补应标记待复核，当前是 ${xiaoGangRecord.reviewFlag}`);
        }
        const evidence = index_1.unifiedStore.getRecordEvidence(xiaoGangRecord.id);
        console.log(`调音师留言证据: ${evidence.evidence.tunerMessage ? '有' : '无(正确——调音师未提及)'}`);
        console.log(`群接龙证据: 行号${evidence.evidence.groupSignup?.originalLineNumber} → "${evidence.evidence.groupSignup?.rawContent}"`);
        console.log(`是否临时替补仅群里有: ${evidence.evidence.isTempSubOnlyInGroup}`);
    }
    sep('票务同事复核');
    let currentRecords = [...step2Records];
    const mismatchRecords = currentRecords.filter(r => r.reviewFlag === index_1.ReviewFlag.MISMATCH);
    console.log(`\n口径不一致待复核: ${mismatchRecords.length} 条`);
    mismatchRecords.forEach(r => {
        const confirmed = (0, index_1.confirmRecord)(r, '票务同事小张', true, '核实后确认以群接龙时间为准');
        const idx = currentRecords.findIndex(x => x.id === r.id);
        if (idx !== -1)
            currentRecords[idx] = confirmed;
        console.log(`  复核 ${r.studentName}: ${r.status} → ${confirmed.status}, ${r.reviewFlag} → ${confirmed.reviewFlag}`);
    });
    const tempSubRecords = currentRecords.filter(r => r.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP);
    console.log(`\n临时替补待复核: ${tempSubRecords.length} 条`);
    tempSubRecords.forEach(r => {
        const confirmed = (0, index_1.confirmTempSubstitute)(r, '票务同事小张', true, '核实确为临时替补');
        const idx = currentRecords.findIndex(x => x.id === r.id);
        if (idx !== -1)
            currentRecords[idx] = confirmed;
        console.log(`  复核 ${r.studentName}: ${r.status} → ${confirmed.status}, ${r.reviewFlag} → ${confirmed.reviewFlag}`);
    });
    index_1.unifiedStore.setRecords(currentRecords);
    sep('第三步：分账明细更新');
    const { records: step3Records, workflow: step3Workflow } = (0, index_1.step3UpdateSettlement)('票务同事小张', step2Workflow);
    console.log(`\n已分账: ${step3Records.filter(r => r.status === index_1.RecordStatus.SETTLED).length} 条`);
    console.log(`待处理: ${step3Records.filter(r => r.status === index_1.RecordStatus.NEEDS_REVIEW).length} 条`);
    console.log(`总分账金额: ${step3Records.reduce((sum, r) => sum + (r.settlementAmount || 0), 0)} 元`);
    console.log(`\n工作流是否收口: ${(0, index_1.isWorkflowDone)(step3Workflow) ? '是 ✓' : '否 ✗'}`);
    step3Workflow.steps.forEach(step => {
        console.log(`  ${step.name}: ${step.status}${step.completedAt ? ' (' + step.completedAt + ')' : ''}`);
    });
    sep('导出明细核对');
    const exportData = index_1.unifiedStore.getForExport();
    console.log(`\n导出条数: ${exportData.length}`);
    console.log();
    exportData.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.studentName} ${row.courseDate} ${row.courseTime} | 状态:${row.status} | 复核:${row.reviewFlag} | 金额:${row.settlementAmount}`);
        console.log(`     调音师行号:${row.tunerOriginalLineNumber || '-'} 原文:"${row.tunerRawContent || '-'}"`);
        console.log(`     群接龙行号:${row.groupOriginalLineNumber || '-'} 原文:"${row.groupRawContent || '-'}"`);
        if (row.groupCourseTime && row.groupCourseTime !== row.courseTime) {
            console.log(`     口径不一致: 调音师${row.courseTime} vs 群接龙${row.groupCourseTime}`);
        }
        if (row.importSource) {
            console.log(`     导入来源: ${row.importSource}${row.importBatchLabel ? ' - ' + row.importBatchLabel : ''}`);
        }
        if (row.manualEditsDetail.length > 0) {
            console.log(`     改动记录(${row.manualEditsCount}):`);
            row.manualEditsDetail.forEach((e) => {
                console.log(`       - ${e.action}${e.field ? '(' + e.field + ')' : ''}: ${e.reason || (e.oldValue + ' → ' + e.newValue)}`);
            });
        }
        console.log();
    });
    sep('数据一致性验证(页面/导出/接口)');
    const pageData = index_1.unifiedStore.getForPageDisplay();
    const apiData = index_1.unifiedStore.getForApiResponse();
    console.log(`\n页面记录数: ${pageData.records.length}`);
    console.log(`导出记录数: ${exportData.length}`);
    console.log(`接口记录数: ${apiData.records.length}`);
    const consistencyIssues = (0, index_1.verifyExportConsistency)(pageData.records, exportData);
    console.log(`导出一致性: ${consistencyIssues.length === 0 ? '通过 ✓' : '发现问题 ✗'}`);
    if (consistencyIssues.length > 0) {
        consistencyIssues.forEach(i => console.log(`  - ${i.message}`));
    }
    const tempSubInExport = exportData.find(r => r.studentName === '小刚');
    const tempSubInPage = pageData.records.find(r => r.studentName === '小刚');
    const tempSubInApi = apiData.records.find(r => r.studentName === '小刚');
    console.log(`\n临时替补(小刚)一致性:`);
    console.log(`  页面状态: ${tempSubInPage?.status}  复核标记: ${tempSubInPage?.reviewFlag}`);
    console.log(`  导出状态: ${tempSubInExport?.status}  复核标记: ${tempSubInExport?.reviewFlag}`);
    console.log(`  接口状态: ${tempSubInApi?.status}  复核标记: ${tempSubInApi?.reviewFlag}`);
    const allSameForTempSub = tempSubInPage?.status === tempSubInExport?.status &&
        tempSubInPage?.status === tempSubInApi?.status &&
        tempSubInPage?.reviewFlag === tempSubInExport?.reviewFlag &&
        tempSubInPage?.reviewFlag === tempSubInApi?.reviewFlag;
    console.log(`  三端一致: ${allSameForTempSub ? '是 ✓' : '否 ✗'}`);
    sep('从导出追回原始材料');
    const xiaoMingExport = exportData.find(r => r.studentName === '小明' && r.courseDate === '2026-06-01');
    if (xiaoMingExport) {
        console.log(`\n从导出明细追回"小明 2026-06-01":`);
        console.log(`  调音师留言原文: "${xiaoMingExport.tunerRawContent}"`);
        console.log(`  群接龙原文:     "${xiaoMingExport.groupRawContent}"`);
        console.log(`  调音师行号: ${xiaoMingExport.tunerOriginalLineNumber}`);
        console.log(`  群接龙行号: ${xiaoMingExport.groupOriginalLineNumber}`);
        console.log(`  口径不一致详情: ${xiaoMingExport.groupCourseTime && xiaoMingExport.groupCourseTime !== xiaoMingExport.courseTime ? `调音师${xiaoMingExport.courseTime} vs 群接龙${xiaoMingExport.groupCourseTime}` : '无'}`);
    }
    sep('重复导入复现');
    const { records: reimportRecords, reuseReport: reimportReuse, workflow: reimportWorkflow } = (0, index_1.step1ImportTunerMessages)(tunerMessages, '调音师小王');
    console.log(`\n同一批调音师留言第二次导入:`);
    console.log(`  复用记录: ${reimportReuse.reused}`);
    console.log(`  真新增:   ${reimportReuse.newlyAdded}`);
    const reusedRecords = reimportRecords.filter(r => r.importSource === 'reimport_reuse');
    const firstTimeRecords = reimportRecords.filter(r => r.importSource === 'tuner_first');
    console.log(`\n  复用记录(本次导入中的):`);
    reusedRecords.forEach(r => {
        console.log(`    - ${r.studentName} ${r.courseDate} ${r.courseTime} | 标记: ${r.importSource}`);
        console.log(`      说明: ${r.importBatchLabel}`);
    });
    console.log(`\n  首次导入记录(之前已有的):`);
    firstTimeRecords.forEach(r => {
        console.log(`    - ${r.studentName} ${r.courseDate} ${r.courseTime} | 标记: ${r.importSource}`);
    });
    const pageAfterReimport = index_1.unifiedStore.getForPageDisplay();
    const reimportIssues = pageAfterReimport.selfCheck.issues.filter(i => i.type === 'duplicate');
    console.log(`\n  页面自检-重复记录报告: ${reimportIssues.length} 条`);
    reimportIssues.forEach(i => {
        console.log(`    [${i.severity}] ${i.message}`);
    });
    sep('总结');
    const allPassed = (0, index_1.isWorkflowDone)(step3Workflow) &&
        consistencyIssues.length === 0 &&
        allSameForTempSub &&
        xiaoMingRecord?.reviewFlag === index_1.ReviewFlag.MISMATCH &&
        xiaoGangRecord?.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP;
    console.log(`\n工作流收口:       ${(0, index_1.isWorkflowDone)(step3Workflow) ? '通过 ✓' : '失败 ✗'}`);
    console.log(`导出一致性:       ${consistencyIssues.length === 0 ? '通过 ✓' : '失败 ✗'}`);
    console.log(`三端数据一致:     ${allSameForTempSub ? '通过 ✓' : '失败 ✗'}`);
    console.log(`口径不一致检出:   ${xiaoMingRecord?.reviewFlag === index_1.ReviewFlag.MISMATCH ? '通过 ✓' : '失败 ✗'}`);
    console.log(`临时替补不自动归正常: ${xiaoGangRecord?.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP ? '通过 ✓' : '失败 ✗'}`);
    console.log(`重复导入区分:     ${reimportReuse.reused > 0 ? '通过 ✓' : '失败 ✗'}`);
    console.log(`\n总体: ${allPassed ? '全部通过 ✓' : '存在问题 ✗'}`);
}
runE2E();
//# sourceMappingURL=test.js.map