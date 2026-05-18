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
exports.FileHandler = exports.OUTPUT_COLUMNS = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sync_1 = require("csv-parse/sync");
const sync_2 = require("csv-stringify/sync");
exports.OUTPUT_COLUMNS = [
    '包裹号',
    '团号',
    '团长ID',
    '团长姓名',
    '自提点',
    '商品SKU',
    '商品名称',
    '订购数量',
    '商品状态',
    '替换原SKU',
    '替换原商品名',
    '处理状态',
    '处理时间',
    '错误信息'
];
class FileHandler {
    readCsv(filePath) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const records = (0, sync_1.parse)(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        return records.map((record, index) => ({
            团号: String(record.团号 || ''),
            团长ID: String(record.团长ID || ''),
            团长姓名: String(record.团长姓名 || ''),
            自提点: String(record.自提点 || ''),
            商品SKU: String(record.商品SKU || ''),
            商品名称: String(record.商品名称 || ''),
            订购数量: parseInt(record.订购数量 || '0', 10),
            商品状态: (record.商品状态 || '正常'),
            替换原SKU: record.替换原SKU ? String(record.替换原SKU) : undefined,
            替换原商品名: record.替换原商品名 ? String(record.替换原商品名) : undefined,
            处理状态: '待处理',
            行号: index + 2
        }));
    }
    writeCsv(filePath, rows) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const records = rows.map(row => {
            const record = {};
            exports.OUTPUT_COLUMNS.forEach(col => {
                record[col] = row[col] ?? '';
            });
            return record;
        });
        const csvContent = (0, sync_2.stringify)(records, {
            header: true,
            columns: exports.OUTPUT_COLUMNS,
            encoding: 'utf-8'
        });
        fs.writeFileSync(filePath, '\uFEFF' + csvContent);
    }
    writeResult(outputDir, fileName, result) {
        const baseName = path.basename(fileName, path.extname(fileName));
        if (result.success.length > 0) {
            this.writeCsv(path.join(outputDir, `${baseName}_成功.csv`), result.success);
        }
        if (result.skipped.length > 0) {
            this.writeCsv(path.join(outputDir, `${baseName}_跳过.csv`), result.skipped);
        }
        if (result.failed.length > 0) {
            this.writeCsv(path.join(outputDir, `${baseName}_失败.csv`), result.failed);
        }
    }
    getInputFiles(inputPath) {
        if (!fs.existsSync(inputPath)) {
            return [];
        }
        const stat = fs.statSync(inputPath);
        if (stat.isFile()) {
            return [inputPath];
        }
        if (stat.isDirectory()) {
            const files = fs.readdirSync(inputPath)
                .filter(f => f.endsWith('.csv'))
                .map(f => path.join(inputPath, f))
                .sort();
            return files;
        }
        return [];
    }
}
exports.FileHandler = FileHandler;
