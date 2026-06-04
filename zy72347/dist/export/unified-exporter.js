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
exports.buildRecordView = buildRecordView;
exports.getRecords = getRecords;
exports.getRecordDetail = getRecordDetail;
exports.exportData = exportData;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-stringify/sync");
const data_store_1 = require("../store/data-store");
const format_detector_1 = require("../core/format-detector");
const engine_1 = require("../workflow/engine");
const audit_log_1 = require("../store/audit-log");
function buildRecordView(record, options = {}) {
    const { includeRawValues = false, includeChangeHistory = false, includeAnnotations = false, displayFormat = 'decimal', } = options;
    const statusText = {
        imported: '已导入',
        detected_mixed: '检测到混合格式',
        pending_review: '待活动负责人复核',
        reviewed: '已复核',
        approved: '已批准',
        rejected: '已拒绝',
        normalized: '已自动归一化',
        completed: '已完成',
        rolled_back: '已回滚',
    };
    const formatText = {
        percentage: '百分数',
        decimal: '小数',
        mixed: '混合格式',
        unknown: '未知格式',
    };
    const values = {};
    record.normalizedValues.forEach((num, key) => {
        values[key] = (0, format_detector_1.formatValue)(num, displayFormat);
    });
    if (record.normalizedValues.size === 0) {
        record.rawValues.forEach((raw, key) => {
            values[key] = raw.original;
        });
    }
    const view = {
        id: record.id,
        originalRowNumber: record.originalRowNumber,
        sourceFile: record.sourceFile,
        importTime: new Date(record.importTimestamp).toLocaleString('zh-CN'),
        importedBy: record.importedBy,
        status: record.status,
        statusText: statusText[record.status] || record.status,
        currentStep: record.currentStep,
        workflowStatus: (0, engine_1.getWorkflowStatus)(record),
        hasMixedFormat: record.hasMixedFormat,
        formatDetected: formatText[record.formatDetected] || record.formatDetected,
        values,
        reviewAssignee: record.reviewAssignee,
        reviewDecision: record.reviewDecision,
        reviewTime: record.reviewTimestamp
            ? new Date(record.reviewTimestamp).toLocaleString('zh-CN')
            : undefined,
        completedBy: record.completedBy,
        completedTime: record.completedTimestamp
            ? new Date(record.completedTimestamp).toLocaleString('zh-CN')
            : undefined,
    };
    if (includeRawValues) {
        view.rawValues = {};
        record.rawValues.forEach((raw, key) => {
            view.rawValues[key] = {
                original: raw.original,
                format: formatText[raw.format] || raw.format,
                numericValue: raw.numericValue,
            };
        });
        view.normalizedValues = Object.fromEntries(record.normalizedValues.entries());
    }
    if (includeChangeHistory) {
        view.changeHistory = record.changeHistory.map((ch) => ({
            time: new Date(ch.timestamp).toLocaleString('zh-CN'),
            operator: ch.operator,
            field: ch.field,
            oldValue: ch.oldValue,
            newValue: ch.newValue,
            reason: ch.reason,
        }));
    }
    if (includeAnnotations) {
        view.annotations = record.annotations.map((ann) => ({
            time: new Date(ann.timestamp).toLocaleString('zh-CN'),
            author: ann.author,
            content: ann.content,
            screenshotRef: ann.screenshotRef,
        }));
    }
    return view;
}
function getRecords(options = {}) {
    const { includeMixedOnly = false } = options;
    let records;
    if (includeMixedOnly) {
        records = (0, data_store_1.getRecordsWithMixedFormat)();
    }
    else {
        records = (0, data_store_1.getAllRecords)();
    }
    const views = records.map((r) => buildRecordView(r, {
        includeRawValues: true,
        includeChangeHistory: true,
        includeAnnotations: true,
    }));
    return { success: true, data: views, errors: [], warnings: [] };
}
function getRecordDetail(recordId) {
    const records = (0, data_store_1.getAllRecords)();
    const record = records.find((r) => r.id === recordId);
    if (!record) {
        return { success: false, errors: [`未找到记录 ${recordId}`], warnings: [] };
    }
    const view = buildRecordView(record, {
        includeRawValues: true,
        includeChangeHistory: true,
        includeAnnotations: true,
    });
    return { success: true, data: view, errors: [], warnings: [] };
}
function exportData(options) {
    const { format, includeMixedOnly = false, includeRawValues = false, includeChangeHistory = false, includeAnnotations = false, displayFormat = 'decimal', outputPath, operator, } = options;
    let records;
    if (includeMixedOnly) {
        records = (0, data_store_1.getRecordsWithMixedFormat)();
    }
    else {
        records = (0, data_store_1.getAllRecords)();
    }
    const views = records.map((r) => buildRecordView(r, {
        includeRawValues,
        includeChangeHistory,
        includeAnnotations,
        displayFormat,
    }));
    let output;
    switch (format) {
        case 'json':
            output = JSON.stringify(views, null, 2);
            break;
        case 'csv': {
            if (views.length === 0) {
                output = '无数据';
                break;
            }
            const headers = ['记录ID', '原始行号', '源文件', '导入时间', '导入人', '状态', '工作流步骤', '是否混合格式', '检测格式'];
            const valueKeys = Object.keys(views[0].values);
            headers.push(...valueKeys);
            const rows = views.map((v) => [
                v.id,
                v.originalRowNumber,
                v.sourceFile,
                v.importTime,
                v.importedBy,
                v.statusText,
                v.workflowStatus,
                v.hasMixedFormat ? '是' : '否',
                v.formatDetected,
                ...valueKeys.map((k) => v.values[k] || ''),
            ]);
            output = (0, sync_1.stringify)([headers, ...rows]);
            break;
        }
        case 'detail': {
            const lines = [];
            views.forEach((v, idx) => {
                lines.push(`=== 记录 ${idx + 1}/${views.length} ===`);
                lines.push(`记录ID: ${v.id}`);
                lines.push(`原始行号: ${v.originalRowNumber} (来自 ${v.sourceFile})`);
                lines.push(`导入时间: ${v.importTime} (by ${v.importedBy})`);
                lines.push(`状态: ${v.statusText}`);
                lines.push(`工作流步骤: ${v.workflowStatus}`);
                lines.push(`格式检测: ${v.formatDetected}`);
                lines.push(`是否混合格式: ${v.hasMixedFormat ? '是 ⚠️' : '否'}`);
                lines.push('');
                lines.push('--- 数值 ---');
                Object.entries(v.values).forEach(([key, val]) => {
                    lines.push(`  ${key}: ${val}`);
                });
                if (v.rawValues) {
                    lines.push('');
                    lines.push('--- 原始值 ---');
                    Object.entries(v.rawValues).forEach(([key, raw]) => {
                        lines.push(`  ${key}: "${raw.original}" -> ${raw.format} -> ${raw.numericValue}`);
                    });
                }
                if (v.changeHistory && v.changeHistory.length > 0) {
                    lines.push('');
                    lines.push('--- 变更历史 ---');
                    v.changeHistory.forEach((ch, i) => {
                        lines.push(`  ${i + 1}. [${ch.time}] ${ch.operator}`);
                        lines.push(`     字段: ${ch.field}`);
                        lines.push(`     ${ch.oldValue} → ${ch.newValue}`);
                        lines.push(`     原因: ${ch.reason}`);
                    });
                }
                if (v.annotations && v.annotations.length > 0) {
                    lines.push('');
                    lines.push('--- 批注 ---');
                    v.annotations.forEach((ann, i) => {
                        lines.push(`  ${i + 1}. [${ann.time}] ${ann.author}: ${ann.content}`);
                        if (ann.screenshotRef) {
                            lines.push(`     截图: ${ann.screenshotRef}`);
                        }
                    });
                }
                if (v.reviewAssignee) {
                    lines.push('');
                    lines.push('--- 复核信息 ---');
                    lines.push(`  复核人: ${v.reviewAssignee}`);
                    if (v.reviewDecision) {
                        lines.push(`  决定: ${v.reviewDecision}`);
                        lines.push(`  时间: ${v.reviewTime}`);
                    }
                    else {
                        lines.push(`  状态: 待复核`);
                    }
                }
                lines.push('');
            });
            output = lines.join('\n');
            break;
        }
        case 'summary': {
            const total = views.length;
            const mixed = views.filter((v) => v.hasMixedFormat).length;
            const pending = views.filter((v) => v.status === 'pending_review').length;
            const approved = views.filter((v) => v.status === 'approved' || v.status === 'completed').length;
            const rejected = views.filter((v) => v.status === 'rejected').length;
            const rolledBack = views.filter((v) => v.status === 'rolled_back').length;
            output = `
=== 贝塞尔曲线路径平滑 - 汇总报告 ===
生成时间: ${new Date().toLocaleString('zh-CN')}
操作人: ${operator}

总记录数: ${total}
混合格式记录: ${mixed}
待复核: ${pending}
已批准/已完成: ${approved}
已拒绝: ${rejected}
已回滚: ${rolledBack}

混合格式记录列表:
${views
                .filter((v) => v.hasMixedFormat)
                .map((v) => `  - [行${v.originalRowNumber}] ${v.id} - ${v.statusText}`)
                .join('\n') || '  (无)'}
`.trim();
            break;
        }
        default:
            return { success: false, errors: [`不支持的导出格式: ${format}`], warnings: [] };
    }
    if (outputPath) {
        const fullPath = path.resolve(outputPath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, output, 'utf-8');
        (0, audit_log_1.logAction)(operator, 'DATA_EXPORTED', {
            format,
            outputPath: fullPath,
            recordCount: views.length,
            includeMixedOnly,
        });
    }
    return { success: true, data: output, errors: [], warnings: [] };
}
//# sourceMappingURL=unified-exporter.js.map