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
const importService_1 = require("./importService");
const reconciliationService_1 = require("./reconciliationService");
const reviewService_1 = require("./reviewService");
const reportService_1 = require("./reportService");
const types_1 = require("./types");
async function runDemo() {
    console.log('========================================');
    console.log('      MCN样品对账服务演示');
    console.log('========================================\n');
    const importService = new importService_1.ImportService();
    const reconciliationService = new reconciliationService_1.ReconciliationService('2024-04-01');
    const reportService = new reportService_1.ReportService();
    console.log('步骤 1: 导入数据...');
    const { shipments, influencers } = await importService.loadSampleData();
    console.log(`  - 成功导入 ${shipments.length} 条寄送单记录`);
    console.log(`  - 成功导入 ${influencers.length} 位达人信息\n`);
    console.log('步骤 2: 运行自动对账...');
    const { records, summary, discrepancies } = reconciliationService.runReconciliation(shipments);
    console.log(`  - 生成 ${records.length} 条对账记录`);
    console.log(`  - 检测到 ${discrepancies.length} 个差异\n`);
    console.log('步骤 3: 显示初始对账汇总...');
    console.log(`  - 总记录数: ${summary.totalShipments}`);
    console.log(`  - 按时归还: ${summary.returnedOnTime}`);
    console.log(`  - 超期未还: ${summary.overdue}`);
    console.log(`  - 破损: ${summary.damaged}`);
    console.log(`  - 总扣款金额: ¥${summary.totalDeduction}`);
    console.log(`  - 待复核: ${summary.pendingReview}\n`);
    console.log('步骤 4: 显示待复核的差异（按记录分组）...');
    records.filter(r => r.discrepancies.length > 0).forEach((record, index) => {
        console.log(`  记录 ${index + 1}: ${record.influencerName} - ${record.sampleName}`);
        console.log(`     差异数量: ${record.discrepancies.length}`);
        console.log(`     差异类型: ${(0, types_1.getAllDiscrepancyTypes)(record)}`);
        record.discrepancies.forEach((d, dIndex) => {
            console.log(`       ${dIndex + 1}. [${d.type}]`);
            console.log(`          描述: ${d.description}`);
            console.log(`          金额: ¥${d.amount}`);
            console.log(`          来源: ${d.source}`);
        });
        console.log();
    });
    console.log('步骤 5: 进行人工复核...');
    const reviewService = new reviewService_1.ReviewService(records);
    const pendingRecords = reviewService.getPendingRecords();
    const updates = [
        {
            recordId: pendingRecords[0].id,
            newStatus: types_1.SampleStatus.RETURNED,
            deductionAmount: 0,
            reviewNotes: '确认样品已于3月28日归还，免除扣款',
            resolveDiscrepancy: true
        },
        {
            recordId: pendingRecords[1].id,
            deductionAmount: 300,
            reviewNotes: '经协商，破损样品按¥300扣款处理',
            resolveDiscrepancy: true
        }
    ];
    console.log(`  - 正在复核 ${updates.length} 条记录...`);
    reviewService.batchUpdate(updates, '样品管理员-张三');
    const updatedSummary = reviewService.getSummary();
    const modifiedRecords = reviewService.getModifiedRecords();
    console.log(`  - 已完成人工复核`);
    console.log(`  - 复核后总扣款金额: ¥${updatedSummary.totalDeduction}\n`);
    console.log('步骤 6: 显示人工修正后的记录...');
    modifiedRecords.forEach((r, index) => {
        console.log(`  ${index + 1}. ${r.influencerName} - ${r.sampleName}`);
        console.log(`     状态变化: ${r.originalStatus} → ${r.currentStatus}`);
        console.log(`     扣款金额: ¥${r.deductionAmount}`);
        console.log(`     差异数量: ${r.discrepancies.length}`);
        console.log(`     差异类型: ${(0, types_1.getAllDiscrepancyTypes)(r)}`);
        console.log(`     复核人: ${r.reviewer}`);
        console.log(`     备注: ${r.reviewNotes}\n`);
    });
    console.log('步骤 7: 生成对账报告...');
    const finalRecords = reviewService.getRecords();
    const finalDiscrepancies = reviewService.getDiscrepancies();
    const report = reportService.generateReport('BATCH2024Q1', finalRecords, updatedSummary, finalDiscrepancies);
    const outputDir = path.join(__dirname, '../output');
    const reportFiles = reportService.exportFullReport(report, outputDir);
    const textReportPath = path.join(outputDir, `reconciliation-${report.batchCode}-summary.txt`);
    reportService.exportTextReport(report, textReportPath);
    console.log(`  - 报告已生成至: ${outputDir}`);
    console.log(`  - JSON报告: ${path.basename(reportFiles.jsonPath)}`);
    console.log(`  - 对账记录CSV: ${path.basename(reportFiles.recordsCsvPath)}`);
    console.log(`  - 汇总CSV: ${path.basename(reportFiles.summaryCsvPath)}`);
    console.log(`  - 差异明细CSV: ${path.basename(reportFiles.discrepanciesCsvPath)}`);
    console.log(`  - 文本报告: ${path.basename(textReportPath)}\n`);
    console.log('========================================');
    console.log('            对账完成');
    console.log('========================================');
    console.log('\n最终汇总统计:');
    console.log(`  - 总记录数: ${updatedSummary.totalShipments}`);
    console.log(`  - 按时归还: ${updatedSummary.returnedOnTime}`);
    console.log(`  - 超期未还: ${updatedSummary.overdue}`);
    console.log(`  - 破损: ${updatedSummary.damaged}`);
    console.log(`  - 总扣款金额: ¥${updatedSummary.totalDeduction}`);
    console.log(`  - 已复核: ${updatedSummary.reviewed}`);
    console.log('\n感谢使用 MCN样品对账服务!');
}
runDemo().catch(console.error);
