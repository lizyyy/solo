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
exports.importCsv = importCsv;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const data_store_1 = require("../store/data-store");
const format_detector_1 = require("../core/format-detector");
const boundary_rules_1 = require("../core/boundary-rules");
const audit_log_1 = require("../store/audit-log");
const id_1 = require("../utils/id");
function importCsv(options) {
    const { filePath, importedBy, valueColumns, screenshotRef, hasHeader = true, delimiter = ',' } = options;
    const errors = [];
    const importedRecordIds = [];
    let mixedFormatCount = 0;
    let pendingReviewCount = 0;
    let autoNormalizedCount = 0;
    if (!fs.existsSync(filePath)) {
        return {
            success: false,
            errors: [`文件不存在: ${filePath}`],
            warnings: [],
        };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFileName = path.basename(filePath);
    let records;
    try {
        records = (0, sync_1.parse)(content, {
            delimiter,
            skip_empty_lines: true,
        });
    }
    catch (e) {
        return {
            success: false,
            errors: [`CSV 解析失败: ${e.message}`],
            warnings: [],
        };
    }
    if (records.length === 0) {
        return {
            success: false,
            errors: ['CSV 文件为空'],
            warnings: [],
        };
    }
    let headers = [];
    let dataStartRow = 0;
    if (hasHeader) {
        headers = records[0].map((h) => h.trim());
        dataStartRow = 1;
    }
    else {
        headers = valueColumns.length > 0
            ? valueColumns
            : records[0].map((_, i) => `column_${i}`);
    }
    const valueColumnIndices = [];
    valueColumns.forEach((col) => {
        const idx = headers.indexOf(col);
        if (idx >= 0) {
            valueColumnIndices.push(idx);
        }
        else {
            errors.push(`未找到列: ${col}`);
        }
    });
    if (valueColumnIndices.length === 0) {
        return {
            success: false,
            errors: [...errors, '未找到任何数值列'],
            warnings: [],
        };
    }
    (0, audit_log_1.logAction)(importedBy, 'IMPORT_START', {
        sourceFile: sourceFileName,
        valueColumns,
        totalRows: records.length - dataStartRow,
        screenshotRef,
    });
    for (let i = dataStartRow; i < records.length; i++) {
        const row = records[i];
        const originalRowNumber = i + 1;
        if (row.length < Math.max(...valueColumnIndices) + 1) {
            errors.push(`第 ${originalRowNumber} 行: 列数不足`);
            continue;
        }
        const dataRecord = (0, data_store_1.createNewRecord)(originalRowNumber, sourceFileName, importedBy);
        if (screenshotRef) {
            dataRecord.annotations.push({
                id: (0, id_1.generateId)('ann'),
                timestamp: Date.now(),
                author: importedBy,
                content: `旧公式截图导入: ${screenshotRef}`,
                screenshotRef,
            });
        }
        const rawValues = [];
        valueColumnIndices.forEach((colIdx) => {
            const header = headers[colIdx];
            const cellValue = row[colIdx];
            const parsed = (0, format_detector_1.parseValue)(cellValue);
            dataRecord.rawValues.set(header, parsed);
            rawValues.push(parsed);
        });
        dataRecord.hasMixedFormat = (0, format_detector_1.detectMixedFormat)(rawValues);
        const formats = rawValues.map((v) => v.format).filter((f) => f !== 'unknown');
        if (formats.length > 0) {
            const uniqueFormats = new Set(formats);
            if (uniqueFormats.size === 1) {
                dataRecord.formatDetected = Array.from(uniqueFormats)[0];
            }
            else if (dataRecord.hasMixedFormat) {
                dataRecord.formatDetected = 'mixed';
            }
        }
        if (dataRecord.hasMixedFormat) {
            mixedFormatCount++;
            dataRecord.status = 'detected_mixed';
        }
        const triggeredRules = (0, boundary_rules_1.evaluateRules)(dataRecord);
        triggeredRules.forEach((rule) => {
            if (rule.action === 'flag_for_review') {
                pendingReviewCount++;
                dataRecord.status = 'pending_review';
                dataRecord.reviewAssignee = '活动负责人';
            }
            else if (rule.action === 'auto_normalize') {
                autoNormalizedCount++;
                dataRecord.status = 'normalized';
                dataRecord.rawValues.forEach((raw, key) => {
                    dataRecord.normalizedValues.set(key, raw.numericValue);
                });
            }
        });
        const saveResult = (0, data_store_1.saveRecord)(dataRecord);
        if (!saveResult.success) {
            errors.push(`第 ${originalRowNumber} 行保存失败: ${saveResult.errors.join(', ')}`);
            continue;
        }
        importedRecordIds.push(dataRecord.id);
        (0, audit_log_1.logAction)(importedBy, 'RECORD_IMPORTED', {
            recordId: dataRecord.id,
            originalRowNumber,
            hasMixedFormat: dataRecord.hasMixedFormat,
            formatDetected: dataRecord.formatDetected,
            status: dataRecord.status,
            triggeredRules: triggeredRules.map((r) => r.id),
        }, dataRecord.id);
    }
    (0, audit_log_1.logAction)(importedBy, 'IMPORT_COMPLETE', {
        sourceFile: sourceFileName,
        importedCount: importedRecordIds.length,
        mixedFormatCount,
        pendingReviewCount,
        autoNormalizedCount,
    });
    return {
        success: errors.length === 0,
        data: {
            totalRows: records.length - dataStartRow,
            importedCount: importedRecordIds.length,
            mixedFormatCount,
            pendingReviewCount,
            autoNormalizedCount,
            errors,
            importedRecordIds,
        },
        errors,
        warnings: [],
    };
}
//# sourceMappingURL=csv-importer.js.map