"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const services_1 = require("../services");
const types_1 = require("../types");
async function runTest() {
    console.log('='.repeat(70));
    console.log('街道活动对账服务 - 端到端测试');
    console.log('='.repeat(70));
    console.log('');
    const importService = new services_1.ImportService();
    const reconciliationEngine = new services_1.ReconciliationEngine();
    const reviewService = new services_1.ReviewService();
    const reportService = new services_1.ReportService();
    const dataStore = services_1.DataStore.getInstance();
    const testDataDir = path.join(__dirname, '../../test-data');
    console.log('【步骤1】导入报名数据...');
    const regResult = await importService.parseRegistrationCSV(path.join(testDataDir, 'registrations.csv'));
    console.log(`  成功: ${regResult.validCount}/${regResult.totalCount} 条`);
    if (regResult.warnings.length > 0) {
        regResult.warnings.forEach((w) => console.log(`  警告: ${w}`));
    }
    dataStore.saveRegistrations(regResult.data);
    console.log('');
    console.log('【步骤2】导入候补数据...');
    const waitResult = await importService.parseWaitlistJSON(path.join(testDataDir, 'waitlist.json'));
    console.log(`  成功: ${waitResult.validCount}/${waitResult.totalCount} 条`);
    dataStore.saveWaitlist(waitResult.data);
    console.log('');
    console.log('【步骤3】导入签到数据...');
    const checkResult = await importService.parseCheckInCSV(path.join(testDataDir, 'checkins.csv'));
    console.log(`  成功: ${checkResult.validCount}/${checkResult.totalCount} 条`);
    dataStore.saveCheckIns(checkResult.data);
    console.log('');
    console.log('【步骤4】导入黑名单数据...');
    const blackResult = await importService.parseBlacklistJSON(path.join(testDataDir, 'blacklist.json'));
    console.log(`  成功: ${blackResult.validCount}/${blackResult.totalCount} 条`);
    dataStore.saveBlacklist(blackResult.data);
    console.log('');
    console.log('【步骤5】执行自动对账...');
    const { batch, records } = reconciliationEngine.processReconciliation('2024年1月街道活动对账', types_1.ActivityType.PARENT_CHILD, '周末亲子手工课 & 老年书法班', dataStore.getAllRegistrations(), dataStore.getAllWaitlist(), dataStore.getAllCheckIns(), dataStore.getAllBlacklist(), '测试操作员');
    console.log(`  批次: ${batch.name}`);
    console.log(`  匹配记录数: ${batch.statistics.matchedRecords}`);
    console.log(`  存在差异: ${batch.statistics.discrepancies}`);
    console.log(`  待复核: ${batch.statistics.pendingReview}`);
    console.log(`  已通过: ${batch.statistics.approved}`);
    console.log('');
    dataStore.saveReconciliationBatch(batch);
    dataStore.saveReconciliationRecords(records);
    console.log('【步骤6】差异分析...');
    const recordsWithIssues = records.filter((r) => r.discrepancies.length > 0);
    recordsWithIssues.forEach((r) => {
        console.log(`  ${r.name} (${r.phone}):`);
        r.discrepancies.forEach((d) => {
            console.log(`    - [${d.severity}] ${d.description}`);
        });
    });
    console.log('');
    console.log('【步骤7】人工复核 - 审批"王五"（已取消但签到）...');
    const wangWu = records.find((r) => r.name === '王五');
    if (wangWu) {
        const updatedWangWu = reviewService.processReviewAction(wangWu, {
            recordId: wangWu.id,
            action: 'approve',
            reason: '现场核实为家属代签，情况属实',
            operator: '张主任',
        });
        dataStore.updateReconciliationRecord(updatedWangWu);
        console.log(`  复核后状态: ${updatedWangWu.reviewStatus}`);
        console.log(`  最终原因: ${updatedWangWu.finalReason}`);
    }
    console.log('');
    console.log('【步骤8】人工复核 - 拒绝"郑十一"（黑名单人员）...');
    const zheng = records.find((r) => r.name === '郑十一');
    if (zheng) {
        const updatedZheng = reviewService.processReviewAction(zheng, {
            recordId: zheng.id,
            action: 'reject',
            reason: '黑名单人员，按规定不予放行',
            operator: '张主任',
        });
        dataStore.updateReconciliationRecord(updatedZheng);
        console.log(`  复核后状态: ${updatedZheng.reviewStatus}`);
    }
    console.log('');
    console.log('【步骤9】人工复核 - 要求补材料"马现场"（无报名但签到）...');
    const ma = records.find((r) => r.name === '马现场');
    if (ma) {
        const updatedMa = reviewService.processReviewAction(ma, {
            recordId: ma.id,
            action: 'request_info',
            reason: '现场报名需补充身份证信息',
            operator: '张主任',
        });
        dataStore.updateReconciliationRecord(updatedMa);
        console.log(`  复核后状态: ${updatedMa.reviewStatus}`);
    }
    console.log('');
    console.log('【步骤10】重新计算统计数据...');
    const allRecords = dataStore.getReconciliationRecordsByBatch(batch.id);
    const updatedBatch = reconciliationEngine.recalculateStatistics(batch, allRecords);
    console.log(`  待复核: ${updatedBatch.statistics.pendingReview}`);
    console.log(`  已通过: ${updatedBatch.statistics.approved}`);
    console.log(`  已拒绝: ${updatedBatch.statistics.rejected}`);
    dataStore.saveReconciliationBatch(updatedBatch);
    console.log('');
    console.log('【步骤11】状态解释 - 追溯"张三"放行原因...');
    const zhangSan = records.find((r) => r.name === '张三');
    if (zhangSan) {
        const explanation = reviewService.explainFinalStatus(zhangSan);
        const checkInTrace = reviewService.traceCheckInSource(zhangSan);
        console.log(`  姓名: ${zhangSan.name}`);
        console.log(`  最终状态: ${explanation.status}`);
        console.log(`  原因: ${explanation.reason}`);
        console.log(`  签到来源: ${checkInTrace.checkInSource}`);
        console.log(`  证据链:`);
        explanation.evidence.forEach((e) => console.log(`    ${e}`));
    }
    console.log('');
    console.log('【步骤12】状态解释 - 追溯"王五"放行原因...');
    const wangWu2 = allRecords.find((r) => r.name === '王五');
    if (wangWu2) {
        const explanation = reviewService.explainFinalStatus(wangWu2);
        console.log(`  姓名: ${wangWu2.name}`);
        console.log(`  最终状态: ${explanation.status}`);
        console.log(`  原因: ${explanation.reason}`);
        console.log(`  证据链:`);
        explanation.evidence.forEach((e) => console.log(`    ${e}`));
    }
    console.log('');
    console.log('【步骤13】生成报告...');
    const outputDir = path.join(__dirname, '../../test-output');
    const fs = require('fs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const detailedReport = reportService.generateDetailedReport(updatedBatch, allRecords);
    fs.writeFileSync(path.join(outputDir, '对账详情.txt'), detailedReport, 'utf-8');
    console.log('  已生成: 对账详情.txt');
    const summaryCSV = reportService.generateSummaryCSV(updatedBatch, allRecords);
    fs.writeFileSync(path.join(outputDir, '对账汇总.csv'), '\uFEFF' + summaryCSV, 'utf-8');
    console.log('  已生成: 对账汇总.csv');
    const discrepancyReport = reportService.generateDiscrepancyReport(updatedBatch, allRecords);
    fs.writeFileSync(path.join(outputDir, '差异分析.txt'), discrepancyReport, 'utf-8');
    console.log('  已生成: 差异分析.txt');
    const auditCSV = reportService.generateAuditTrailCSV(allRecords);
    fs.writeFileSync(path.join(outputDir, '审计追踪.csv'), '\uFEFF' + auditCSV, 'utf-8');
    console.log('  已生成: 审计追踪.csv');
    const jsonReport = reportService.generateJSONReport(updatedBatch, allRecords);
    fs.writeFileSync(path.join(outputDir, '对账报告.json'), jsonReport, 'utf-8');
    console.log('  已生成: 对账报告.json');
    console.log('');
    console.log('='.repeat(70));
    console.log('测试完成！报告已输出到 test-output 目录');
    console.log('='.repeat(70));
}
runTest().catch(console.error);
