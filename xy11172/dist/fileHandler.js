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
exports.FileHandler = exports.ERROR_COLUMNS = exports.OUTPUT_COLUMNS = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const sync_2 = require("csv-stringify/sync");
exports.OUTPUT_COLUMNS = [
    '车辆编号',
    '回库日期',
    '药品编码',
    '药品名称',
    '批号',
    '出库数量',
    '销售数量',
    '回库数量',
    '途中报损数量',
    '报损原因',
    '拆分批号',
    '拆分后数量',
    '状态',
    '处理标记',
    '备注'
];
exports.ERROR_COLUMNS = [
    ...exports.OUTPUT_COLUMNS,
    '错误类型',
    '错误信息',
    '修复建议'
];
class FileHandler {
    readCsvFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        return records.map((record) => ({
            车辆编号: record.车辆编号 || '',
            回库日期: record.回库日期 || '',
            药品编码: record.药品编码 || '',
            药品名称: record.药品名称 || '',
            批号: record.批号 || '',
            出库数量: parseInt(record.出库数量) || 0,
            销售数量: parseInt(record.销售数量) || 0,
            回库数量: parseInt(record.回库数量) || 0,
            途中报损数量: parseInt(record.途中报损数量) || 0,
            报损原因: record.报损原因 || '',
            拆分批号: record.拆分批号 || '',
            拆分后数量: parseInt(record.拆分后数量) || 0,
            状态: record.状态 || '',
            处理标记: record.处理标记 || '',
            备注: record.备注 || ''
        }));
    }
    writeSuccessFile(filePath, records) {
        this.ensureDirectory(filePath);
        const content = (0, sync_2.stringify)(records, {
            header: true,
            columns: exports.OUTPUT_COLUMNS
        });
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    writeSkippedFile(filePath, records) {
        this.ensureDirectory(filePath);
        const content = (0, sync_2.stringify)(records, {
            header: true,
            columns: exports.OUTPUT_COLUMNS
        });
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    writeFailedFile(filePath, records) {
        this.ensureDirectory(filePath);
        const content = (0, sync_2.stringify)(records, {
            header: true,
            columns: exports.ERROR_COLUMNS
        });
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    writeRerunFile(filePath, records) {
        this.ensureDirectory(filePath);
        const content = (0, sync_2.stringify)(records, {
            header: true,
            columns: exports.OUTPUT_COLUMNS
        });
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    ensureDirectory(filePath) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    getOutputPaths(inputPath) {
        const dir = path.dirname(inputPath);
        const name = path.basename(inputPath, '.csv');
        return {
            success: path.join(dir, 'output', `${name}_成功.csv`),
            skipped: path.join(dir, 'output', `${name}_跳过.csv`),
            failed: path.join(dir, 'output', `${name}_失败.csv`),
            rerun: path.join(dir, 'output', `${name}_可复跑.csv`)
        };
    }
}
exports.FileHandler = FileHandler;
