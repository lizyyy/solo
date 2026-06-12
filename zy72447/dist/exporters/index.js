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
const presenter_1 = require("../shared/presenter");
function exportResultsToExcel(store, outputPath) {
    const details = store.getResultsWithDetails();
    const rows = details.map(({ result, groupRecord, contractRecord }) => {
        const row = (0, presenter_1.buildDetailRow)(result, groupRecord, contractRecord);
        return (0, presenter_1.detailRowToExportColumns)(row);
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '核对明细');
    const summaryItems = (0, presenter_1.buildSummary)(details);
    const summaryRows = summaryItems.map((s) => ({
        统计项: s.label,
        数量: s.value,
        标识: s.key
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
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
    const rows = state.logs.map((log) => {
        const row = (0, presenter_1.buildLogRow)(log);
        return {
            操作ID: row.id,
            操作类型: row.operationType,
            实体类型: row.entityType,
            实体ID: row.entityId,
            操作人: row.operator,
            时间: row.timestamp,
            批次ID: row.batchId,
            备注: row.notes,
            旧状态摘要: row.oldStateSummary,
            新状态摘要: row.newStateSummary
        };
    });
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