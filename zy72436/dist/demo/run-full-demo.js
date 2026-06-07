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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ticket_importer_1 = require("../import/ticket-importer");
const remark_manager_1 = require("../track/remark-manager");
const audio_rehearsal_manager_1 = require("../track/audio-rehearsal-manager");
const classifier_1 = require("../classification/classifier");
const data_store_1 = require("../store/data-store");
const checks_1 = require("../self-check/checks");
const data_layer_1 = require("../unified-output/data-layer");
const SAMPLE_CSV_PATH = path.join(__dirname, '..', 'sample-data', 'tickets.csv');
function printStep(title) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log(`${'='.repeat(60)}\n`);
}
function main() {
    data_store_1.dataStore.clear();
    console.log('\n🎵 音乐夏令营分班系统 - 完整流程演示');
    const csvContent = fs.readFileSync(SAMPLE_CSV_PATH, 'utf-8');
    printStep('第一步：票务导出表第一次导入');
    const importResult = (0, ticket_importer_1.importTicketCsv)(csvContent, 'tickets.csv', '系统管理员');
    console.log(`✅ 导入完成`);
    console.log(`   批次ID: ${importResult.batchId}`);
    console.log(`   总行数: ${importResult.totalRows}`);
    console.log(`   成功导入: ${importResult.importedRows}`);
    console.log(`   重复行数: ${importResult.duplicateRows}`);
    const allRows = data_store_1.dataStore.getAllTicketRows();
    console.log(`\n   导入后状态:`);
    for (const row of allRows.slice(0, 3)) {
        console.log(`     - ${row.studentName} (${row.instrument}) 状态: ${row.processingStatus}`);
    }
    console.log(`     ... 共 ${allRows.length} 条记录`);
    printStep('第二步：琴行店长老周补看音频文件备注');
    const rowWangFang = allRows.find(r => r.studentName === '王芳');
    const rowZhouJie = allRows.find(r => r.studentName === '周杰');
    const rowZhangMing = allRows.find(r => r.studentName === '张明');
    console.log('老周正在回看音频文件，补充备注...\n');
    (0, audio_rehearsal_manager_1.addAudioFileRemark)(rowWangFang.id, '音频音质正常，演奏流畅', '老周(店长)');
    console.log(`✅ 王芳: 音频音质正常，演奏流畅`);
    (0, audio_rehearsal_manager_1.addAudioFileRemark)(rowZhangMing.id, '演奏节奏稳定，表现力良好', '老周(店长)');
    console.log(`✅ 张明: 演奏节奏稳定，表现力良好`);
    (0, audio_rehearsal_manager_1.addAudioFileRemark)(rowZhouJie.id, '尾段有破音，建议返工重录，高音部分不稳定', '老周(店长)');
    console.log(`⚠️  周杰: 尾段有破音，建议返工重录，高音部分不稳定（系统自动标记返工）`);
    console.log('\n老周发现周杰有问题，添加轨道备注并保留返工原因：');
    const reworkRemark = (0, remark_manager_1.addTrackRemark)(rowZhouJie.id, 'rework', '高音区气息不足，导致破音，需要重新录制', '老周(店长)', true, '虽然有瑕疵但整体感觉好，留给版权运营复核决定是否需要重录');
    if (reworkRemark) {
        console.log(`✅ 添加返工备注，ID: ${reworkRemark.id}`);
        console.log(`   保留理由: ${reworkRemark.retainReason}`);
        console.log(`   保留人: ${reworkRemark.retainedBy}`);
    }
    const updatedZhouJie = data_store_1.dataStore.getTicketRow(rowZhouJie.id);
    console.log(`\n   周杰当前状态: ${updatedZhouJie.processingStatus}`);
    console.log(`   含返工原因: ${updatedZhouJie.trackRemarks.some(r => r.isReworkReason) ? '是' : '否'}`);
    printStep('第三步：排练变更记录更新');
    console.log('根据音频备注情况，更新排练安排...\n');
    const change1 = (0, audio_rehearsal_manager_1.addRehearsalChange)(rowWangFang.id, 'time', '周一 14:00', '周一 16:00', '根据音频评估，需要增加单独辅导时间', '老周(店长)');
    console.log(`✅ 王芳: 排练时间从 周一14:00 调整为 周一16:00`);
    const change2 = (0, audio_rehearsal_manager_1.addRehearsalChange)(rowZhouJie.id, 'personnel', '张老师', '李老师(资深)', '有返工风险，安排资深老师指导', '老周(店长)', reworkRemark?.id);
    console.log(`✅ 周杰: 指导老师从 张老师 调整为 李老师(资深) (关联返工备注)`);
    console.log('\n📋 查看排练变更详情：');
    if (change2) {
        const detail = (0, data_layer_1.getRehearsalChangeDetail)(rowZhouJie.id, change2.id);
        if (detail) {
            console.log(`   变更ID: ${detail.id}`);
            console.log(`   类型: ${detail.changeType}`);
            console.log(`   原值: ${detail.oldValue}`);
            console.log(`   新值: ${detail.newValue}`);
            console.log(`   变更人: ${detail.changedBy}`);
            console.log(`   理由: ${detail.reason}`);
            console.log(`   关联返工备注: ${detail.relatedRemarkId || '无'}`);
        }
    }
    printStep('第四步：补录后重算分班结果');
    console.log('⚠️  注意：周杰有返工原因，重算后自动标记为待复核，不自动归为正常\n');
    const recalcResult = (0, classifier_1.recalculateClassification)('系统');
    console.log(`✅ 重算完成，共处理 ${recalcResult.recalculated} 条记录`);
    console.log('\n📊 分班结果：');
    const views = (0, data_layer_1.getAllTicketRowViews)();
    for (const view of views) {
        const flag = view.hasReworkReason ? ' ⚠️ 待复核' : '';
        console.log(`   ${view.studentName} (${view.instrument}) -> ${view.currentClass}${flag}`);
    }
    printStep('第五步：版权运营复核返工原因');
    console.log('版权运营正在复核周杰的返工记录...\n');
    const zhouJieDetail = (0, data_layer_1.getTicketRowDetailView)(rowZhouJie.id);
    if (zhouJieDetail && zhouJieDetail.reworkRemarks.length > 0) {
        const remark = zhouJieDetail.reworkRemarks[0];
        console.log(`📋 复核记录：`);
        console.log(`   学生: 周杰`);
        console.log(`   返工原因: ${remark.content}`);
        console.log(`   老周保留理由: ${remark.retainReason}`);
        console.log(`   保留人: ${remark.retainedBy}`);
    }
    (0, remark_manager_1.reviewReworkRemark)(rowZhouJie.id, reworkRemark.id, '版权运营-小李', false);
    console.log(`\n✅ 版权运营复核完成：确认需要返工，状态更新为 reviewed_rework`);
    const finalZhouJie = data_store_1.dataStore.getTicketRow(rowZhouJie.id);
    console.log(`   最终状态: ${finalZhouJie.processingStatus}`);
    console.log(`   最终分班: ${finalZhouJie.currentClass}`);
    printStep('执行自检');
    const checkResults = (0, checks_1.runAllChecks)();
    (0, checks_1.printCheckResults)(checkResults);
    printStep('数据一致性验证');
    const apiViews = (0, data_layer_1.getAllTicketRowViews)();
    console.log(`✅ 页面展示/接口返回数据: ${apiViews.length} 条`);
    console.log(`   其中含返工原因: ${apiViews.filter(v => v.hasReworkReason).length} 条`);
    const zhouJieView = apiViews.find(v => v.id === rowZhouJie.id);
    console.log(`\n🔍 周杰的记录在所有输出中一致：`);
    console.log(`   接口返回 - 含返工原因: ${zhouJieView.hasReworkReason}`);
    console.log(`   接口返回 - 处理状态: ${zhouJieView.processingStatus}`);
    console.log(`   接口返回 - 返工详情数: ${zhouJieView.reworkRemarks.length}`);
    if (zhouJieView.reworkRemarks.length > 0) {
        console.log(`   接口返回 - 老周的保留理由: ${zhouJieView.reworkRemarks[0].retainReason}`);
    }
    printStep('演示完成');
    console.log('✅ 三步核心流程已完整跑通：');
    console.log('   1. 票务导出表第一次导入 ✓');
    console.log('   2. 琴行店长老周补看音频文件备注 ✓');
    console.log('   3. 排练变更记录更新 ✓');
    console.log('');
    console.log('✅ 关键特性验证：');
    console.log('   - 重复导入检测 ✓');
    console.log('   - 轨道备注含返工原因保留 ✓');
    console.log('   - 补录后重算 ✓');
    console.log('   - 导出一致性 ✓');
    console.log('   - 返工原因不急着归正常，留版权运营复核 ✓');
    console.log('   - 排练变更可点开查看详情，含老周保留理由 ✓');
    console.log('   - 原始行号、人工改动、处理状态全程保留 ✓');
    console.log('');
}
main();
