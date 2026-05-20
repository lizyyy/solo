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
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
const Application_1 = __importStar(require("../models/Application"));
const BatchService_1 = __importDefault(require("./BatchService"));
const dayjs_1 = __importDefault(require("dayjs"));
class CsvImportService {
    async parseCsv(fileBuffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const readable = stream_1.Readable.from(fileBuffer);
            readable
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', reject);
        });
    }
    validateRow(row, index) {
        if (!row.merchantName?.trim()) {
            return `第 ${index + 1} 行：商户名称不能为空`;
        }
        if (!row.contactPerson?.trim()) {
            return `第 ${index + 1} 行：联系人不能为空`;
        }
        if (!row.contactPhone?.trim()) {
            return `第 ${index + 1} 行：联系电话不能为空`;
        }
        if (!row.stallType?.trim()) {
            return `第 ${index + 1} 行：摊位类型不能为空`;
        }
        if (!row.stallLocation?.trim()) {
            return `第 ${index + 1} 行：摊位位置不能为空`;
        }
        if (!row.startDate?.trim()) {
            return `第 ${index + 1} 行：开始日期不能为空`;
        }
        if (!row.endDate?.trim()) {
            return `第 ${index + 1} 行：结束日期不能为空`;
        }
        const startDate = (0, dayjs_1.default)(row.startDate);
        const endDate = (0, dayjs_1.default)(row.endDate);
        if (!startDate.isValid()) {
            return `第 ${index + 1} 行：开始日期格式不正确`;
        }
        if (!endDate.isValid()) {
            return `第 ${index + 1} 行：结束日期格式不正确`;
        }
        if (startDate.isAfter(endDate)) {
            return `第 ${index + 1} 行：开始日期不能晚于结束日期`;
        }
        return null;
    }
    async importBatch(batchId, rows, operator) {
        const result = {
            success: 0,
            failed: 0,
            errors: [],
            imported: [],
        };
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const error = this.validateRow(row, i);
            if (error) {
                result.failed++;
                result.errors.push({ row: i + 1, message: error, data: row });
                continue;
            }
            try {
                const applicationNo = row.applicationNo || `APP${(0, dayjs_1.default)().format('YYYYMMDDHHmmss')}${String(i + 1).padStart(4, '0')}`;
                const application = await Application_1.default.create({
                    batchId,
                    applicationNo,
                    merchantName: row.merchantName.trim(),
                    contactPerson: row.contactPerson.trim(),
                    contactPhone: row.contactPhone.trim(),
                    stallType: row.stallType.trim(),
                    stallLocation: row.stallLocation.trim(),
                    startDate: (0, dayjs_1.default)(row.startDate).toDate(),
                    endDate: (0, dayjs_1.default)(row.endDate).toDate(),
                    depositAmount: parseFloat(row.depositAmount || '0'),
                    status: Application_1.ApplicationStatus.PENDING,
                    certificateVersion: row.certificateVersion?.trim() || null,
                    importedAt: new Date(),
                });
                result.success++;
                result.imported.push({ id: application.id, applicationNo });
            }
            catch (err) {
                result.failed++;
                result.errors.push({
                    row: i + 1,
                    message: err.message || '导入失败',
                    data: row,
                });
            }
        }
        await BatchService_1.default.incrementCounts(batchId, result.success, result.failed);
        return result;
    }
    async importFromBuffer(batchId, fileBuffer, operator) {
        const rows = await this.parseCsv(fileBuffer);
        return this.importBatch(batchId, rows, operator);
    }
}
exports.default = new CsvImportService();
