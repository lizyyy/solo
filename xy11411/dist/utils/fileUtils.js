"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFileHash = calculateFileHash;
exports.calculateContentHash = calculateContentHash;
exports.fileExists = fileExists;
exports.directoryExists = directoryExists;
exports.detectFileType = detectFileType;
exports.detectSourceType = detectSourceType;
exports.parseCsvFile = parseCsvFile;
exports.parseExcelFile = parseExcelFile;
exports.parseDataFile = parseDataFile;
exports.formatDate = formatDate;
exports.formatCurrency = formatCurrency;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const xlsx_1 = __importDefault(require("xlsx"));
const types_1 = require("../models/types");
function calculateFileHash(filePath) {
    const content = fs_1.default.readFileSync(filePath);
    return crypto_1.default.createHash('sha256').update(content).digest('hex');
}
function calculateContentHash(content) {
    return crypto_1.default.createHash('sha256').update(content).digest('hex');
}
function fileExists(filePath) {
    return fs_1.default.existsSync(filePath) && fs_1.default.statSync(filePath).isFile();
}
function directoryExists(dirPath) {
    return fs_1.default.existsSync(dirPath) && fs_1.default.statSync(dirPath).isDirectory();
}
function detectFileType(filePath) {
    const ext = path_1.default.extname(filePath).toLowerCase();
    return ext.startsWith('.') ? ext.slice(1) : ext;
}
function detectSourceType(fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('order') || lowerName.includes('订货') || lowerName.includes('订单')) {
        return types_1.DataSourceType.ORDER;
    }
    if (lowerName.includes('loss') || lowerName.includes('损耗') || lowerName.includes('waste')) {
        return types_1.DataSourceType.LOSS;
    }
    if (lowerName.includes('price') || lowerName.includes('价格') || lowerName.includes('总部')) {
        return types_1.DataSourceType.PRICE;
    }
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].some(ext => lowerName.endsWith(ext))) {
        return types_1.DataSourceType.PHOTO;
    }
    throw new Error(`无法识别数据源类型: ${fileName}`);
}
async function parseCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        let headers = [];
        fs_1.default.createReadStream(filePath)
            .pipe((0, csv_parser_1.default)())
            .on('headers', (h) => {
            headers = h;
        })
            .on('data', (row) => {
            rows.push(row);
        })
            .on('end', () => {
            resolve({ headers, rows });
        })
            .on('error', reject);
    });
}
function parseExcelFile(filePath) {
    const workbook = xlsx_1.default.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx_1.default.utils.sheet_to_json(firstSheet, { header: 1 });
    if (data.length === 0) {
        return { headers: [], rows: [] };
    }
    const headers = data[0].map(h => String(h || ''));
    const rows = [];
    for (let i = 1; i < data.length; i++) {
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = data[i][j];
        }
        rows.push(row);
    }
    return { headers, rows };
}
async function parseDataFile(filePath) {
    const fileType = detectFileType(filePath);
    switch (fileType) {
        case 'csv':
            return parseCsvFile(filePath);
        case 'xls':
        case 'xlsx':
            return parseExcelFile(filePath);
        default:
            throw new Error(`不支持的文件类型: ${fileType}`);
    }
}
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY'
    }).format(amount);
}
