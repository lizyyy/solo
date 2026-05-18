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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const xlsx_1 = __importDefault(require("xlsx"));
class FileParser {
    constructor() {
        this.supportedFormats = ['.csv', '.xlsx', '.xls'];
    }
    isSupportedFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return this.supportedFormats.includes(ext);
    }
    async parseFile(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        if (!this.isSupportedFile(filePath)) {
            return {
                fileName,
                success: false,
                items: [],
                errors: [{
                        lineNumber: 0,
                        fileName,
                        errorType: 'UNSUPPORTED_FORMAT',
                        message: `不支持的文件格式: ${ext}`,
                        rawContent: ''
                    }]
            };
        }
        try {
            if (ext === '.csv') {
                return this.parseCSV(filePath, fileName);
            }
            else {
                return this.parseExcel(filePath, fileName);
            }
        }
        catch (error) {
            return {
                fileName,
                success: false,
                items: [],
                errors: [{
                        lineNumber: 0,
                        fileName,
                        errorType: 'FILE_READ_ERROR',
                        message: `文件读取失败: ${error.message}`,
                        rawContent: ''
                    }]
            };
        }
    }
    async parseCSV(filePath, fileName) {
        return new Promise((resolve) => {
            const items = [];
            const errors = [];
            const lines = fs.readFileSync(filePath, 'utf8').split('\n');
            if (lines.length === 0) {
                resolve({ fileName, success: true, items, errors });
                return;
            }
            const headers = lines[0].split(',').map(h => h.trim());
            for (let i = 1; i < lines.length; i++) {
                const lineNumber = i + 1;
                const line = lines[i].trim();
                if (!line)
                    continue;
                const values = line.split(',');
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = (values[index] || '').trim();
                });
                try {
                    const parsedItem = this.parseRow(row, lineNumber, fileName);
                    items.push(parsedItem);
                }
                catch (error) {
                    errors.push({
                        lineNumber,
                        fileName,
                        errorType: 'PARSE_ERROR',
                        message: error.message,
                        rawContent: JSON.stringify(row)
                    });
                    items.push({
                        raw: row,
                        lineNumber,
                        fileName,
                        data: null
                    });
                }
            }
            resolve({
                fileName,
                success: errors.length === 0,
                items,
                errors
            });
        });
    }
    parseExcel(filePath, fileName) {
        const items = [];
        const errors = [];
        const workbook = xlsx_1.default.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = xlsx_1.default.utils.sheet_to_json(worksheet, { header: 1 });
        const headers = jsonData[0] || [];
        for (let i = 1; i < jsonData.length; i++) {
            const lineNumber = i + 1;
            const row = jsonData[i];
            if (!row || row.every(cell => cell === undefined || cell === null || cell === '')) {
                continue;
            }
            const rowObj = {};
            headers.forEach((header, index) => {
                rowObj[header] = row[index];
            });
            try {
                const parsedItem = this.parseRow(rowObj, lineNumber, fileName);
                items.push(parsedItem);
            }
            catch (error) {
                errors.push({
                    lineNumber,
                    fileName,
                    errorType: 'PARSE_ERROR',
                    message: error.message,
                    rawContent: JSON.stringify(row)
                });
                items.push({
                    raw: rowObj,
                    lineNumber,
                    fileName,
                    data: null
                });
            }
        }
        return {
            fileName,
            success: errors.length === 0,
            items,
            errors
        };
    }
    parseRow(row, lineNumber, fileName) {
        const requiredFields = ['name', 'category', 'width', 'height', 'depth', 'weight'];
        const missingFields = requiredFields.filter(field => row[field] === undefined || row[field] === '');
        if (missingFields.length > 0) {
            throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        const width = parseFloat(row.width);
        const height = parseFloat(row.height);
        const depth = parseFloat(row.depth);
        const weight = parseFloat(row.weight);
        if (isNaN(width) || isNaN(height) || isNaN(depth) || isNaN(weight)) {
            throw new Error('尺寸或重量必须是有效数字');
        }
        if (width <= 0 || height <= 0 || depth <= 0 || weight <= 0) {
            throw new Error('尺寸或重量必须大于0');
        }
        const furnitureItem = {
            id: row.id || `ITEM-${lineNumber}`,
            name: String(row.name),
            category: String(row.category),
            width,
            height,
            depth,
            weight,
            isNonDisassemblable: String(row.isNonDisassemblable || 'false').toLowerCase() === 'true',
            quantity: parseInt(row.quantity || '1', 10) || 1
        };
        return {
            raw: row,
            lineNumber,
            fileName,
            data: furnitureItem
        };
    }
    async parseFiles(filePaths) {
        const results = [];
        for (const filePath of filePaths) {
            try {
                const result = await this.parseFile(filePath);
                results.push(result);
            }
            catch (error) {
                results.push({
                    fileName: path.basename(filePath),
                    success: false,
                    items: [],
                    errors: [{
                            lineNumber: 0,
                            fileName: path.basename(filePath),
                            errorType: 'PROCESSING_ERROR',
                            message: `处理文件时出错: ${error.message}`,
                            rawContent: ''
                        }]
                });
            }
        }
        return results;
    }
}
exports.FileParser = FileParser;
