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
exports.exportResultsToExcel = exportResultsToExcel;
exports.exportAuditLogToExcel = exportAuditLogToExcel;
const XLSX = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const types_1 = require("../types");
const STATUS_LABELS = {
    [types_1.RecordStatus.PENDING_IMPORT]: '待导入',
    [types_1.RecordStatus.IMPORTED]: '已导入',
    [types_1.RecordStatus.MATCHED]: '已匹配',
    [types_1.RecordStatus.NEEDS_REVIEW]: '待复核',
    [types_1.RecordStatus.CONFIRMED]: '已确认',
    [types_1.RecordStatus.REJECTED]: '已驳回',
    [types_1.RecordStatus.SUPERSEDED]: '已替换'
};
const REASON_LABELS = {
    [types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP]: '临时替补仅在群里提及',
    [types_1.ReviewReason.CONTRACT_MISSING]: '缺少合同页截图',
    [types_1.ReviewReason.GROUP_RECORD_MISSING]: '缺少排练群接龙记录',
    [types_1.ReviewReason.INFO_MISMATCH]: '信息不一致',
    [types_1.ReviewReason.MANUAL_REVIEW_REQUIRED]: '需人工复核'
};
function exportResultsToExcel(store, outputPath) {
    const details = store.getResultsWithDetails();
    const rows = details.map(({ result, groupRecord, contractRecord }) => ({
        核对结果ID: result.id,
        状态: STATUS_LABELS[result.status],
        表演者: result.matchedPerformerName || '',
        曲目: result.matchedSongName || '',
        是否晚到材料: result.isLateContractRefresh ? '是' : '否',
        复核原因: result.reviewReasons.map((r) => REASON_LABELS[r]).join('; '),
        复核备注: result.reviewNotes || '',
        复核人: result.reviewedBy || '',
        复核时间: result.reviewedAt || '',
        接龙原始行号: groupRecord?.originalRowNumber || '',
        接龙原始内容: groupRecord?.rawContent || '',
        接龙解析姓名: groupRecord?.performerName || '',
        接龙解析曲目: groupRecord?.songName || '',
        是否临时替补: groupRecord?.isTemporarySubstitute ? '是' : '否',
        替补备注: groupRecord?.substituteNote || '',
        接龙导入批次: groupRecord?.importBatchId || '',
        接龙导入时间: groupRecord?.importedAt || '',
        接龙人工改动: groupRecord?.manualEdits.length
            ? groupRecord.manualEdits
                .map((e) => `${e.fieldName}: ${e.oldValue}→${e.newValue} (${e.editedBy})`)
                .join('; ')
            : '',
        合同原始内容: contractRecord?.rawContent || '',
        合同解析姓名: contractRecord?.performerName || '',
        合同解析曲目: contractRecord?.songName || '',
        合同编号: contractRecord?.contractReference || '',
        演出日期: contractRecord?.performanceDate || '',
        合同导入批次: contractRecord?.importBatchId || '',
        合同导入时间: contractRecord?.importedAt || '',
        合同人工改动: contractRecord?.manualEdits.length
            ? contractRecord.manualEdits
                .map((e) => `${e.fieldName}: ${e.oldValue}→${e.newValue} (${e.editedBy})`)
                .join('; ')
            : '',
        创建时间: result.createdAt,
        更新时间: result.updatedAt
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '核对明细');
    const summary = [
        { 统计项: '总记录数', 数量: details.length },
        { 统计项: '已确认', 数量: details.filter((d) => d.result.status === types_1.RecordStatus.CONFIRMED).length },
        { 统计项: '待复核', 数量: details.filter((d) => d.result.status === types_1.RecordStatus.NEEDS_REVIEW).length },
        { 统计项: '已匹配', 数量: details.filter((d) => d.result.status === types_1.RecordStatus.MATCHED).length },
        { 统计项: '已驳回', 数量: details.filter((d) => d.result.status === types_1.RecordStatus.REJECTED).length },
        { 统计项: '临时替补待复核', 数量: details.filter((d) => d.result.reviewReasons.includes(types_1.ReviewReason.TEMP_SUBSTITUTE_ONLY_IN_GROUP)).length },
        { 统计项: '缺少合同截图', 数量: details.filter((d) => d.result.reviewReasons.includes(types_1.ReviewReason.CONTRACT_MISSING)).length },
        { 统计项: '晚到材料刷新', 数量: details.filter((d) => d.result.isLateContractRefresh).length }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, '统计汇总');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    XLSX.writeFile(wb, outputPath);
    return outputPath;
}
function exportAuditLogToExcel(store, outputPath) {
    const state = store.getState();
    const rows = state.logs.map((log) => ({
        操作ID: log.id,
        操作类型: log.operationType,
        实体类型: log.entityType,
        实体ID: log.entityId || '',
        操作人: log.operator,
        时间: log.timestamp,
        批次ID: log.batchId || '',
        备注: log.notes || '',
        旧状态: log.oldState ? JSON.stringify(log.oldState) : '',
        新状态: log.newState ? JSON.stringify(log.newState) : ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '操作日志');
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    XLSX.writeFile(wb, outputPath);
    return outputPath;
}
//# sourceMappingURL=index.js.map