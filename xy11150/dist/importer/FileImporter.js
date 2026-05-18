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
exports.FileImporter = exports.ColumnMappingError = exports.FileImportError = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const iconv = __importStar(require("iconv-lite"));
const sync_1 = require("csv-parse/sync");
const ShuttleRegistration_1 = require("../models/ShuttleRegistration");
class FileImportError extends Error {
    constructor(message, fileName, cause) {
        super(message);
        this.fileName = fileName;
        this.cause = cause;
        this.name = 'FileImportError';
    }
}
exports.FileImportError = FileImportError;
class ColumnMappingError extends Error {
    constructor(message, missingColumns, availableColumns) {
        super(message);
        this.missingColumns = missingColumns;
        this.availableColumns = availableColumns;
        this.name = 'ColumnMappingError';
    }
}
exports.ColumnMappingError = ColumnMappingError;
class FileImporter {
    constructor(customMapping) {
        this.columnMapping = { ...ShuttleRegistration_1.DEFAULT_COLUMN_MAPPING, ...customMapping };
    }
    importFile(filePath, options) {
        if (!fs.existsSync(filePath)) {
            throw new FileImportError(`文件不存在: ${filePath}`, filePath);
        }
        const fileSize = fs.statSync(filePath).size;
        if (fileSize === 0) {
            throw new FileImportError(`文件为空: ${filePath}`, filePath);
        }
        const encoding = this.detectEncoding(filePath, options?.encoding);
        const content = this.readFileWithEncoding(filePath, encoding);
        const delimiter = options?.delimiter || ',';
        const hasHeader = options?.hasHeader !== false;
        const parsed = this.parseCsv(content, delimiter, hasHeader);
        const headers = parsed.headers;
        if (parsed.rows.length === 0) {
            return { records: [], invalidRecords: [], headers };
        }
        const fieldMapping = this.resolveColumnMapping(headers);
        const records = [];
        const invalidRecords = [];
        const fileName = path.basename(filePath);
        for (let i = 0; i < parsed.rows.length; i++) {
            const rowNumber = hasHeader ? i + 2 : i + 1;
            const rawData = parsed.rows[i];
            const { record, errors } = this.parseRow(rawData, fieldMapping, fileName, rowNumber);
            if (errors.length > 0) {
                invalidRecords.push({
                    sourceFile: fileName,
                    rowNumber,
                    rawData,
                    errors
                });
            }
            else {
                records.push(record);
            }
        }
        return { records, invalidRecords, headers };
    }
    importFiles(filePaths, options) {
        const allRecords = [];
        const allInvalidRecords = [];
        const fileResults = [];
        for (const filePath of filePaths) {
            const fileName = path.basename(filePath);
            try {
                const result = this.importFile(filePath, options);
                allRecords.push(...result.records);
                allInvalidRecords.push(...result.invalidRecords);
                fileResults.push({
                    fileName,
                    success: true,
                    recordCount: result.records.length
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                fileResults.push({
                    fileName,
                    success: false,
                    recordCount: 0,
                    error: errorMessage
                });
            }
        }
        return {
            records: allRecords,
            invalidRecords: allInvalidRecords,
            fileResults
        };
    }
    detectEncoding(filePath, encoding) {
        if (encoding && encoding !== 'Auto') {
            return encoding;
        }
        const buffer = fs.readFileSync(filePath);
        if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
            return 'UTF-8';
        }
        try {
            const gbkContent = iconv.decode(buffer, 'GBK');
            if (gbkContent.includes('员工') || gbkContent.includes('班车') || gbkContent.includes('线路')) {
                return 'GBK';
            }
        }
        catch {
        }
        return 'UTF-8';
    }
    readFileWithEncoding(filePath, encoding) {
        const buffer = fs.readFileSync(filePath);
        try {
            if (encoding === 'GBK' || encoding === 'GB2312') {
                return iconv.decode(buffer, 'GBK');
            }
            return buffer.toString('utf8');
        }
        catch (error) {
            throw new FileImportError(`文件编码错误，无法解析: ${error instanceof Error ? error.message : String(error)}`, filePath, error instanceof Error ? error : undefined);
        }
    }
    parseCsv(content, delimiter, hasHeader) {
        try {
            const records = (0, sync_1.parse)(content, {
                delimiter,
                columns: hasHeader,
                skip_empty_lines: true,
                trim: true
            });
            const headers = hasHeader && records.length > 0 ? Object.keys(records[0]) : [];
            const rows = hasHeader ? records : records.map((row, index) => {
                const obj = {};
                row.forEach((val, idx) => {
                    obj[`column_${idx}`] = val;
                });
                return obj;
            });
            return { headers, rows };
        }
        catch (error) {
            throw new Error(`CSV解析失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    resolveColumnMapping(headers) {
        const fieldMapping = new Map();
        const missingColumns = [];
        const requiredFields = ['employeeId', 'employeeName', 'phone', 'routeName'];
        for (const field of requiredFields) {
            const possibleNames = this.columnMapping[field];
            let matchedColumn = null;
            for (const possibleName of possibleNames) {
                const found = headers.find(h => h.trim().toLowerCase() === possibleName.trim().toLowerCase());
                if (found) {
                    matchedColumn = found;
                    break;
                }
            }
            if (matchedColumn) {
                fieldMapping.set(field, matchedColumn);
            }
            else {
                missingColumns.push(field);
            }
        }
        if (missingColumns.length > 0) {
            const missingNames = missingColumns.map(c => this.columnMapping[c][0]).join('、');
            throw new ColumnMappingError(`缺少必要的列: ${missingNames}`, missingNames.split('、'), headers);
        }
        const optionalFields = [
            'department', 'boardingPoint', 'boardingTime', 'registrationDate', 'status'
        ];
        for (const field of optionalFields) {
            const possibleNames = this.columnMapping[field];
            for (const possibleName of possibleNames) {
                const found = headers.find(h => h.trim().toLowerCase() === possibleName.trim().toLowerCase());
                if (found) {
                    fieldMapping.set(field, found);
                    break;
                }
            }
        }
        return fieldMapping;
    }
    parseRow(rawData, fieldMapping, sourceFile, rowNumber) {
        const errors = [];
        const getValue = (field) => {
            const column = fieldMapping.get(field);
            if (!column)
                return '';
            const value = rawData[column];
            return value !== undefined && value !== null ? String(value).trim() : '';
        };
        const employeeId = getValue('employeeId');
        const employeeName = getValue('employeeName');
        const phone = getValue('phone');
        const routeName = getValue('routeName');
        if (!employeeId && !employeeName && !phone) {
            errors.push('员工信息缺失: 员工编号、姓名、手机号不能同时为空');
        }
        if (!routeName) {
            errors.push('线路名称不能为空');
        }
        if (errors.length > 0) {
            return { errors };
        }
        const record = {
            employeeId,
            employeeName,
            department: getValue('department'),
            phone,
            routeName,
            boardingPoint: getValue('boardingPoint'),
            boardingTime: getValue('boardingTime'),
            registrationDate: getValue('registrationDate'),
            status: this.parseStatus(getValue('status')),
            rawData,
            sourceFile,
            rowNumber
        };
        return { record, errors };
    }
    parseStatus(status) {
        const statusMap = {
            '正常': '正常',
            'active': '正常',
            '有效': '正常',
            '调岗': '调岗',
            'transfer': '调岗',
            '调动': '调岗',
            '待审核': '待审核',
            'pending': '待审核',
            '审核中': '待审核',
            '已取消': '已取消',
            'cancelled': '已取消',
            '取消': '已取消'
        };
        return statusMap[status?.trim()] || '正常';
    }
}
exports.FileImporter = FileImporter;
//# sourceMappingURL=FileImporter.js.map