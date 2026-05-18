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
const csv_parser_1 = __importDefault(require("csv-parser"));
class FileParser {
    constructor() {
        this.errors = [];
    }
    async parseFile(filePath) {
        this.errors = [];
        const records = [];
        const fileName = path.basename(filePath);
        if (!fs.existsSync(filePath)) {
            this.errors.push({
                file: fileName,
                errorType: 'parse_failed',
                message: `文件不存在: ${filePath}`
            });
            return { records: [], errors: this.errors };
        }
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.csv') {
            return this.parseCSV(filePath, fileName);
        }
        else if (ext === '.json') {
            return this.parseJSON(filePath, fileName);
        }
        else {
            this.errors.push({
                file: fileName,
                errorType: 'format_error',
                message: `不支持的文件格式: ${ext}`
            });
            return { records: [], errors: this.errors };
        }
    }
    async parseCSV(filePath, fileName) {
        const records = [];
        let rowNumber = 0;
        return new Promise((resolve) => {
            fs.createReadStream(filePath, 'utf8')
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                rowNumber++;
                try {
                    const record = this.validateAndTransformRow(row, fileName, rowNumber);
                    if (record) {
                        records.push(record);
                    }
                }
                catch (e) {
                    this.errors.push({
                        file: fileName,
                        rowNumber,
                        errorType: 'format_error',
                        message: e.message,
                        rawData: JSON.stringify(row)
                    });
                }
            })
                .on('end', () => {
                resolve({ records, errors: this.errors });
            })
                .on('error', (err) => {
                this.errors.push({
                    file: fileName,
                    errorType: 'parse_failed',
                    message: `CSV解析失败: ${err.message}`
                });
                resolve({ records: [], errors: this.errors });
            });
        });
    }
    async parseJSON(filePath, fileName) {
        const records = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            const rows = Array.isArray(data) ? data : [data];
            rows.forEach((row, index) => {
                try {
                    const record = this.validateAndTransformRow(row, fileName, index + 1);
                    if (record) {
                        records.push(record);
                    }
                }
                catch (e) {
                    this.errors.push({
                        file: fileName,
                        rowNumber: index + 1,
                        errorType: 'format_error',
                        message: e.message,
                        rawData: JSON.stringify(row)
                    });
                }
            });
        }
        catch (err) {
            this.errors.push({
                file: fileName,
                errorType: 'parse_failed',
                message: `JSON解析失败: ${err.message}`
            });
        }
        return { records, errors: this.errors };
    }
    validateAndTransformRow(row, fileName, rowNumber) {
        const requiredFields = ['employeeId', 'name', 'department', 'examinationDate', 'clinicName', 'reportType'];
        const missingFields = requiredFields.filter(field => !row[field]);
        if (missingFields.length > 0) {
            this.errors.push({
                file: fileName,
                rowNumber,
                errorType: 'missing_field',
                message: `缺少必填字段: ${missingFields.join(', ')}`,
                rawData: JSON.stringify(row)
            });
            return null;
        }
        const validReportTypes = ['普通体检', '入职体检', '年度体检', '健康证'];
        if (!validReportTypes.includes(row.reportType)) {
            this.errors.push({
                file: fileName,
                rowNumber,
                errorType: 'invalid_data',
                message: `无效的报告类型: ${row.reportType}，有效值为: ${validReportTypes.join(', ')}`,
                rawData: JSON.stringify(row)
            });
            return null;
        }
        const validReportStatuses = ['pending', 'completed', 'withdrawn'];
        let reportStatus = row.reportStatus || 'completed';
        if (!validReportStatuses.includes(reportStatus)) {
            reportStatus = 'completed';
        }
        let items = [];
        if (row.items) {
            if (typeof row.items === 'string') {
                items = row.items.split(/[,，、]/).map((s) => s.trim()).filter(Boolean);
            }
            else if (Array.isArray(row.items)) {
                items = row.items;
            }
        }
        const recordId = this.generateRecordId(row, fileName);
        return {
            id: recordId,
            employeeId: String(row.employeeId).trim(),
            name: String(row.name).trim(),
            department: String(row.department).trim(),
            examinationDate: String(row.examinationDate).trim(),
            reportStatus: reportStatus,
            distributionStatus: 'pending',
            phone: row.phone ? String(row.phone).trim() : undefined,
            email: row.email ? String(row.email).trim() : undefined,
            clinicName: String(row.clinicName).trim(),
            reportType: row.reportType.trim(),
            items,
            sourceFile: fileName,
            processedAt: new Date().toISOString()
        };
    }
    generateRecordId(row, fileName) {
        const key = `${fileName}-${row.employeeId || ''}-${row.name || ''}-${row.examinationDate || ''}`;
        return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    }
}
exports.FileParser = FileParser;
