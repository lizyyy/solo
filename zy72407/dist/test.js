"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const tunerMessages = [
    '张小明,2026-06-01,14:00,李老师,陪练,45,正常上课',
    '王小红,2026-06-01,15:00,王老师,陪练,45,正常上课',
    '李小花,2026-06-02,10:00,张老师,陪练,60,加课',
    '张小明,2026-06-01,14:00,李老师,陪练,45,重复导入测试'
];
const groupSignups = [
    '张小明,2026-06-01,14:00,李老师,现场到',
    '王小红,2026-06-01,15:00,王老师,现场到',
    '刘小刚,2026-06-01,16:00,赵老师,临时替补,现场到',
    '李小花,2026-06-02,10:00,张老师,现场到'
];
function runTests() {
    console.log('========== 琴行陪练套餐消课系统测试 ==========\n');
    console.log('【步骤1】调音师留言第一次导入');
    console.log('----------------------------------------');
    const { records: step1Records, workflow: step1Workflow } = (0, index_1.step1ImportTunerMessages)(tunerMessages, '调音师小王');
    console.log(`导入记录数: ${step1Records.length}`);
    console.log(`重复记录标记: ${step1Records.filter(r => r.status === index_1.RecordStatus.DUPLICATE).length} 条`);
    step1Records.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.studentName} - ${r.courseDate} ${r.courseTime} - ${r.status} - 调音师行号: ${r.tunerOriginalLineNumber}`);
    });
    console.log();
    console.log('【步骤2】版权运营小鹿补看排练群接龙');
    console.log('----------------------------------------');
    const { records: step2Records, workflow: step2Workflow } = (0, index_1.step2ReviewGroupSignup)(groupSignups, '版权运营小鹿', step1Workflow);
    console.log(`合并后记录数: ${step2Records.length}`);
    console.log(`已匹配记录: ${step2Records.filter(r => r.status === index_1.RecordStatus.MATCHED).length} 条`);
    console.log(`待复核记录: ${step2Records.filter(r => r.status === index_1.RecordStatus.NEEDS_REVIEW).length} 条`);
    const tempSubRecords = step2Records.filter(r => r.reviewFlag === index_1.ReviewFlag.TEMP_SUB_ONLY_IN_GROUP);
    console.log(`临时替补仅在群里: ${tempSubRecords.length} 条`);
    tempSubRecords.forEach(r => {
        console.log(`  - ${r.studentName} - ${r.courseDate} ${r.courseTime}`);
        console.log(`    群接龙原始内容: ${r.groupRawContent}`);
        console.log(`    群接龙行号: ${r.groupOriginalLineNumber}`);
    });
    console.log();
    console.log('【自检】运行系统自检');
    console.log('----------------------------------------');
    const pageResult = index_1.unifiedStore.getForPageDisplay();
    console.log(`总记录数: ${pageResult.summary.total}`);
    console.log(`自检问题数: ${pageResult.selfCheck.issues.length}`);
    pageResult.selfCheck.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.type}: ${issue.message}`);
    });
    console.log();
    console.log('【票务同事复核】临时替补记录');
    console.log('----------------------------------------');
    let step2RecordsCopy = [...step2Records];
    tempSubRecords.forEach(r => {
        const confirmed = (0, index_1.confirmTempSubstitute)(r, '票务同事小张', true, '核实确为临时替补');
        const index = step2RecordsCopy.findIndex(x => x.id === r.id);
        if (index !== -1) {
            step2RecordsCopy[index] = confirmed;
        }
        console.log(`复核 ${r.studentName}: 确认通过`);
        console.log(`  状态从 ${r.status} → ${confirmed.status}`);
        console.log(`  复核标记从 ${r.reviewFlag} → ${confirmed.reviewFlag}`);
    });
    index_1.unifiedStore.setRecords(step2RecordsCopy);
    console.log();
    console.log('【步骤3】分账明细更新');
    console.log('----------------------------------------');
    const { records: step3Records, workflow: step3Workflow } = (0, index_1.step3UpdateSettlement)('票务同事小张', step2Workflow);
    console.log(`已分账记录: ${step3Records.filter(r => r.status === index_1.RecordStatus.SETTLED).length} 条`);
    console.log(`总分账金额: ${step3Records.reduce((sum, r) => sum + (r.settlementAmount || 0), 0)} 元`);
    console.log();
    console.log('【验证】数据一致性（页面、导出、接口）');
    console.log('----------------------------------------');
    const pageData = index_1.unifiedStore.getForPageDisplay();
    const exportData = index_1.unifiedStore.getForExport();
    const apiData = index_1.unifiedStore.getForApiResponse();
    console.log(`页面记录数: ${pageData.records.length}`);
    console.log(`导出记录数: ${exportData.length}`);
    console.log(`接口记录数: ${apiData.records.length}`);
    const consistencyIssues = (0, index_1.verifyExportConsistency)(pageData.records, exportData);
    console.log(`导出一致性检查: ${consistencyIssues.length === 0 ? '通过' : '发现问题'}`);
    if (consistencyIssues.length > 0) {
        consistencyIssues.forEach(i => console.log(`  - ${i.message}`));
    }
    console.log();
    console.log('【证据追溯】查看单条记录完整证据链');
    console.log('----------------------------------------');
    const sampleRecord = step3Records.find(r => r.studentName === '刘小刚');
    if (sampleRecord) {
        const evidence = index_1.unifiedStore.getRecordEvidence(sampleRecord.id);
        console.log(`学生: ${evidence.record.studentName}`);
        console.log(`状态: ${evidence.record.status}`);
        console.log(`调音师留言证据: ${evidence.evidence.tunerMessage ? '有' : '无'}`);
        console.log(`群接龙证据: ${evidence.evidence.groupSignup ? '有' : '无'}`);
        if (evidence.evidence.groupSignup) {
            console.log(`  原始行号: ${evidence.evidence.groupSignup.originalLineNumber}`);
            console.log(`  原始内容: ${evidence.evidence.groupSignup.rawContent}`);
        }
        console.log(`人工改动次数: ${evidence.record.manualEdits.length}`);
        console.log('\n完整审计轨迹:');
        const trail = (0, index_1.getRecordAuditTrail)(evidence.record);
        trail.forEach((t, i) => {
            console.log(`  ${i + 1}. ${t.timestamp} - ${t.action}${t.operator ? ' - ' + t.operator : ''}${t.reason ? ' - ' + t.reason : ''}`);
        });
    }
    console.log();
    console.log('【工作流状态】');
    console.log('----------------------------------------');
    step3Workflow.steps.forEach(step => {
        console.log(`  ${step.name}: ${step.status}${step.completedAt ? ' - ' + step.completedAt : ''}`);
    });
    console.log();
    console.log('========== 测试完成 ==========');
}
runTests();
//# sourceMappingURL=test.js.map