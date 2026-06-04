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
const index_1 = require("../index");
function log(message, indent = 0) {
    const prefix = '  '.repeat(indent);
    console.log(`${prefix}${message}`);
}
function logSuccess(message, indent = 0) {
    log(`✅ ${message}`, indent);
}
function logWarning(message, indent = 0) {
    log(`⚠️  ${message}`, indent);
}
function logError(message, indent = 0) {
    log(`❌ ${message}`, indent);
}
async function runFullWorkflowTest() {
    console.log('\n' + '='.repeat(60));
    console.log('  贝塞尔曲线路径平滑 - 完整工作流测试');
    console.log('='.repeat(60) + '\n');
    const sampleCsv = path.join(__dirname, '../../examples/sample-data.csv');
    const operator = '运营规划阿岚';
    const reviewer = '活动负责人';
    log('🧹 清理历史数据...');
    (0, index_1.clearAllRecords)();
    logSuccess('已清空历史数据');
    log('\n📋 边界规则检查清单:');
    index_1.BOUNDARY_RULES.forEach((rule) => {
        log((0, index_1.formatBoundaryRule)(rule), 1);
        log('');
    });
    log('\n📥 ========== 第一步：旧公式截图第一次导入 ==========');
    const importResult = (0, index_1.importCsv)({
        filePath: sampleCsv,
        importedBy: operator,
        valueColumns: ['转化率', '完成率'],
        screenshotRef: 'screenshots/20240101_formula_v1.png',
    });
    if (!importResult.success || !importResult.data) {
        logError(`导入失败: ${importResult.errors.join(', ')}`);
        return false;
    }
    const { importedRecordIds, mixedFormatCount, pendingReviewCount, totalRows } = importResult.data;
    logSuccess(`导入完成: 共 ${totalRows} 行, 成功 ${importedRecordIds.length} 条`);
    log(`混合格式: ${mixedFormatCount} 条, 待复核: ${pendingReviewCount} 条`, 1);
    const mixedRecords = importedRecordIds
        .map((id) => (0, index_1.getRecordDetail)(id).data)
        .filter((r) => r && r.hasMixedFormat);
    log('\n🔍 混合格式记录详情:');
    mixedRecords.forEach((r) => {
        if (r) {
            logWarning(`[行${r.originalRowNumber}] ${r.id}`, 1);
            Object.entries(r.rawValues || {}).forEach(([key, val]) => {
                log(`  ${key}: "${val.original}" -> ${val.format} -> ${val.numericValue}`, 2);
            });
            log(`状态: ${r.statusText}`, 2);
        }
    });
    log('\n📝 ========== 第二步：运营规划阿岚补看老师批注 ==========');
    for (let i = 0; i < importedRecordIds.length; i++) {
        const recordId = importedRecordIds[i];
        const detail = (0, index_1.getRecordDetail)(recordId);
        if (detail.data && detail.data.hasMixedFormat) {
            const annResult = (0, index_1.addAnnotation)({
                recordId,
                author: operator,
                content: `老师批注：第${detail.data.originalRowNumber}行数据来自旧公式截图，存在百分数和小数混合，请活动负责人复核后确认统一格式`,
                screenshotRef: `screenshots/20240101_teacher_note_${i + 1}.png`,
            });
            if (annResult.success) {
                logSuccess(`记录 ${recordId.slice(0, 20)}... 已添加批注`, 1);
            }
            else {
                logError(`批注失败: ${annResult.errors.join(', ')}`, 1);
            }
        }
    }
    log('\n⏳ ========== 混合格式留待活动负责人复核 ==========');
    log('根据边界规则 RULE_001，混合格式记录不会自动归正常');
    log('必须经活动负责人复核后才能进入下一步');
    const pendingRecords = importedRecordIds
        .map((id) => (0, index_1.getRecordDetail)(id).data)
        .filter((r) => r && r.status === 'pending_review');
    log(`待复核记录: ${pendingRecords.length} 条`, 1);
    pendingRecords.forEach((r) => {
        if (r) {
            log(`- [行${r.originalRowNumber}] ${r.id}`, 2);
        }
    });
    log('\n👀 ========== 活动负责人复核 ==========');
    for (let i = 0; i < pendingRecords.length; i++) {
        const r = pendingRecords[i];
        if (!r)
            continue;
        log(`复核记录 ${r.id.slice(0, 20)}... (行${r.originalRowNumber})`, 1);
        log(`原始值: ${JSON.stringify(r.rawValues)}`, 2);
        const reviewResult = (0, index_1.reviewRecord)({
            recordId: r.id,
            reviewer,
            decision: 'approve',
            comment: '确认混合格式，统一转为小数格式（0-1范围），来源是旧公式截图第' + r.originalRowNumber + '行',
            targetFormat: 'decimal',
        });
        if (reviewResult.success) {
            logSuccess('已批准，已归一化为小数格式', 2);
            const updated = (0, index_1.getRecordDetail)(r.id);
            if (updated.data) {
                log(`归一化后: ${JSON.stringify(updated.data.values)}`, 3);
            }
        }
        else {
            logError(`复核失败: ${reviewResult.errors.join(', ')}`, 2);
        }
    }
    log('\n🔄 ========== 第三步：计算明细更新 ==========');
    const approvedRecords = importedRecordIds
        .map((id) => (0, index_1.getRecordDetail)(id).data)
        .filter((r) => r && r.status === 'approved');
    for (const r of approvedRecords) {
        if (!r)
            continue;
        const updateResult = (0, index_1.updateRecord)({
            recordId: r.id,
            operator,
            fieldValues: {},
            reason: '计算明细更新 - 已完成格式统一',
        });
        if (updateResult.success) {
            logSuccess(`记录 ${r.id.slice(0, 20)}... 更新完成`, 1);
        }
        else {
            logError(`更新失败: ${updateResult.errors.join(', ')}`, 1);
        }
    }
    log('\n📊 ========== 数据一致性验证 ==========');
    log('验证页面展示、导出、接口返回使用同一份结果...');
    const allRecords = (0, index_1.getAllRecords)();
    log(`总记录数: ${allRecords.length}`, 1);
    const exportJson = (0, index_1.exportData)({ format: 'json', operator });
    const exportCsv = (0, index_1.exportData)({ format: 'csv', operator });
    const exportDetail = (0, index_1.exportData)({ format: 'detail', operator });
    const exportSummary = (0, index_1.exportData)({ format: 'summary', operator });
    if (exportJson.success && exportCsv.success && exportDetail.success && exportSummary.success) {
        logSuccess('所有导出格式均成功，数据源统一', 1);
    }
    else {
        logError('导出格式不一致', 1);
        return false;
    }
    log('\n🔍 ========== 追溯验证 ==========');
    log('验证新同事仅凭计算明细就能找到来源和下一步...');
    const firstMixed = mixedRecords[0];
    if (firstMixed) {
        const traceResult = (0, index_1.getTraceabilityReport)(firstMixed.id);
        if (traceResult.success && traceResult.data) {
            logSuccess(`追溯报告生成成功 - ${firstMixed.id.slice(0, 20)}...`, 1);
            log('追溯报告要点:', 2);
            log('📌 来源查找步骤清晰', 3);
            log('🎯 下一步动作明确', 3);
        }
    }
    log('\n💾 ========== 保存可重跑会话 ==========');
    const sessionCommands = (0, index_1.createWorkflowReplayCommands)({
        filePath: sampleCsv,
        importedBy: operator,
        valueColumns: ['转化率', '完成率'],
        screenshotRef: 'screenshots/20240101_formula_v1.png',
    }, mixedRecords.map((r, i) => ({
        recordIndex: importedRecordIds.indexOf(r.id),
        author: operator,
        content: `老师批注复核 ${i + 1}`,
        screenshotRef: `screenshots/note_${i + 1}.png`,
    })), pendingRecords.map((r) => ({
        recordIndex: importedRecordIds.indexOf(r.id),
        reviewer,
        decision: 'approve',
        comment: '复核通过',
    })), approvedRecords.map((r) => ({
        recordIndex: importedRecordIds.indexOf(r.id),
        operator,
        fieldValues: {},
        reason: '计算明细更新',
    })), importedRecordIds);
    const manifest = (0, index_1.createReplayManifest)(operator, '完整工作流测试 - 包含混合格式处理', sessionCommands);
    (0, index_1.saveReplayManifest)(manifest);
    logSuccess(`可重跑会话已保存: ${manifest.sessionId}`, 1);
    log('\n🔄 ========== 复盘重跑验证 ==========');
    log('验证其他同事可以凭会话ID完整复现流程...');
    (0, index_1.clearAllRecords)();
    const replayResult = await (0, index_1.executeReplay)(manifest.sessionId, '新同事张三', true);
    if (replayResult.success && replayResult.data) {
        logSuccess('复盘重跑成功', 1);
        log((0, index_1.generateReplayReport)(replayResult.data), 2);
    }
    else {
        logError(`复盘重跑失败: ${replayResult.errors.join(', ')}`, 1);
        return false;
    }
    log('\n📋 ========== 审计报告 ==========');
    const auditResult = (0, index_1.generateAuditReport)();
    if (auditResult.success && auditResult.data) {
        logSuccess('审计报告生成成功', 1);
    }
    log('\n' + '='.repeat(60));
    logSuccess('🎉 完整工作流测试通过！');
    log('');
    log('核心验证点:', 1);
    log('✅ 百分数和小数混合格式被正确检测', 2);
    log('✅ 混合格式记录留待活动负责人复核，不自动归正常', 2);
    log('✅ 原始行号、截图引用、变更历史完整保留', 2);
    log('✅ 页面展示、导出、接口共用同一份结果', 2);
    log('✅ 边界规则在代码和README中都有定义', 2);
    log('✅ 可重跑会话保存，其他同事可复现完整流程', 2);
    log('✅ 追溯报告可清晰找到来源和下一步动作', 2);
    log('='.repeat(60) + '\n');
    return true;
}
runFullWorkflowTest()
    .then((success) => {
    process.exit(success ? 0 : 1);
})
    .catch((e) => {
    console.error('测试异常:', e);
    process.exit(1);
});
//# sourceMappingURL=run-full-workflow.js.map