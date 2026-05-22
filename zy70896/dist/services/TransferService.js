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
exports.transferService = exports.TransferService = void 0;
const uuid_1 = require("uuid");
const FileStorage_1 = require("../storage/FileStorage");
const types_1 = require("../types");
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream = __importStar(require("stream"));
const json2csv_1 = require("json2csv");
class TransferService {
    generateErrorNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `ERR-${timestamp}-${random}`;
    }
    detectIssues(record, schedules) {
        const issues = [];
        const now = new Date().toISOString();
        if (Math.abs(record.difference || 0) > 0.01) {
            issues.push({
                type: types_1.IssueType.AMOUNT_MISMATCH,
                description: `金额差异 ${(record.difference || 0).toFixed(2)} 元，需要核实`,
                detectedAt: now
            });
        }
        if (!record.firstSignature || !record.secondSignature) {
            issues.push({
                type: types_1.IssueType.MISSING_SIGNATURE,
                description: '缺少双签确认，请补充签名',
                detectedAt: now
            });
        }
        const schedule = schedules.find(s => s.tellerId === record.tellerId && s.date === record.transferDate);
        if (!schedule && record.transferDate) {
            issues.push({
                type: types_1.IssueType.CROSS_DAY_TRANSFER,
                description: '跨日交接记录，请确认排班信息',
                detectedAt: now
            });
        }
        return issues;
    }
    async parseCSV(fileContent, batchId) {
        const records = [];
        const schedules = await FileStorage_1.storage.getSchedules();
        const tellers = await FileStorage_1.storage.getTellers();
        return new Promise((resolve, reject) => {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileContent);
            bufferStream
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const teller = tellers.find(t => t.tellerId === row.tellerId);
                const now = new Date().toISOString();
                const previousAmount = parseFloat(row.previousAmount || '0');
                const currentAmount = parseFloat(row.currentAmount || '0');
                const difference = currentAmount - previousAmount;
                const partialRecord = {
                    tellerId: row.tellerId || '',
                    tellerName: teller?.name || row.tellerName || '',
                    cashBoxId: teller?.cashBoxId || row.cashBoxId || '',
                    transferDate: row.transferDate,
                    transferTime: row.transferTime,
                    previousAmount,
                    currentAmount,
                    difference,
                    receivedBy: row.receivedBy,
                    handedOverBy: row.handedOverBy,
                    firstSignature: row.firstSignature,
                    secondSignature: row.secondSignature
                };
                const issues = this.detectIssues(partialRecord, schedules);
                const hasIssues = issues.length > 0;
                const record = {
                    id: (0, uuid_1.v4)(),
                    batchId,
                    tellerId: partialRecord.tellerId || '',
                    tellerName: partialRecord.tellerName || '',
                    cashBoxId: partialRecord.cashBoxId || '',
                    transferDate: partialRecord.transferDate || '',
                    transferTime: partialRecord.transferTime || '',
                    previousAmount: partialRecord.previousAmount || 0,
                    currentAmount: partialRecord.currentAmount || 0,
                    difference: partialRecord.difference || 0,
                    receivedBy: partialRecord.receivedBy || '',
                    handedOverBy: partialRecord.handedOverBy || '',
                    firstSignature: partialRecord.firstSignature || '',
                    secondSignature: partialRecord.secondSignature || '',
                    issues,
                    errorNumber: hasIssues ? this.generateErrorNumber() : undefined,
                    status: hasIssues ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.PENDING,
                    processingHistory: [{
                            status: hasIssues ? types_1.RecordStatus.NEEDS_REVIEW : types_1.RecordStatus.PENDING,
                            handledBy: 'system',
                            handledAt: now
                        }],
                    createdAt: now,
                    updatedAt: now
                };
                records.push(record);
            })
                .on('end', () => {
                resolve(records);
            })
                .on('error', reject);
        });
    }
    async createBatch(name, branchId, createdBy, description) {
        const batch = {
            id: (0, uuid_1.v4)(),
            name,
            description,
            branchId,
            createdBy,
            totalRecords: 0,
            processedRecords: 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await FileStorage_1.storage.saveBatch(batch);
        return batch;
    }
    async addRecordsToBatch(batchId, records) {
        await FileStorage_1.storage.saveRecords(records);
        const batches = await FileStorage_1.storage.getBatches();
        const batch = batches.find(b => b.id === batchId);
        if (batch) {
            batch.totalRecords += records.length;
            batch.updatedAt = new Date().toISOString();
            await FileStorage_1.storage.saveBatch(batch);
        }
    }
    async updateRecordStatus(recordId, status, handledBy, comment) {
        const records = await FileStorage_1.storage.getRecords();
        const record = records.find(r => r.id === recordId);
        if (!record) {
            return null;
        }
        const historyEntry = {
            status,
            handledBy,
            handledAt: new Date().toISOString(),
            comment
        };
        record.processingHistory.push(historyEntry);
        record.status = status;
        record.updatedAt = new Date().toISOString();
        await FileStorage_1.storage.saveRecord(record);
        return record;
    }
    async markProcessed(recordId, handledBy, comment) {
        return this.updateRecordStatus(recordId, types_1.RecordStatus.PROCESSED, handledBy, comment);
    }
    async returnForCorrection(recordId, handledBy, comment) {
        return this.updateRecordStatus(recordId, types_1.RecordStatus.RETURNED, handledBy, comment);
    }
    async approveRecord(recordId, handledBy, comment) {
        return this.updateRecordStatus(recordId, types_1.RecordStatus.APPROVED, handledBy, comment);
    }
    async queryRecords(filters, page = 1, pageSize = 50) {
        let records = await FileStorage_1.storage.getRecords();
        const schedules = await FileStorage_1.storage.getSchedules();
        if (filters.cashBoxId) {
            records = records.filter(r => r.cashBoxId === filters.cashBoxId);
        }
        if (filters.supervisorId) {
            const supervisedTellers = schedules
                .filter(s => s.supervisorId === filters.supervisorId)
                .map(s => s.tellerId);
            records = records.filter(r => supervisedTellers.includes(r.tellerId));
        }
        if (filters.errorNumber) {
            records = records.filter(r => r.errorNumber === filters.errorNumber);
        }
        if (filters.tellerId) {
            records = records.filter(r => r.tellerId === filters.tellerId);
        }
        if (filters.status) {
            records = records.filter(r => r.status === filters.status);
        }
        if (filters.batchId) {
            records = records.filter(r => r.batchId === filters.batchId);
        }
        if (filters.startDate) {
            records = records.filter(r => r.transferDate >= filters.startDate);
        }
        if (filters.endDate) {
            records = records.filter(r => r.transferDate <= filters.endDate);
        }
        const total = records.length;
        const start = (page - 1) * pageSize;
        const paginatedData = records.slice(start, start + pageSize);
        return {
            data: paginatedData,
            total,
            page,
            pageSize
        };
    }
    async exportRecords(filters) {
        const result = await this.queryRecords(filters, 1, 10000);
        const exportData = result.data.map(record => ({
            '记录编号': record.id,
            '批次编号': record.batchId,
            '柜员ID': record.tellerId,
            '柜员姓名': record.tellerName,
            '尾箱编号': record.cashBoxId,
            '交接日期': record.transferDate,
            '交接时间': record.transferTime,
            '上期金额': record.previousAmount.toFixed(2),
            '本期金额': record.currentAmount.toFixed(2),
            '差额': record.difference.toFixed(2),
            '接收人': record.receivedBy,
            '移交人': record.handedOverBy,
            '状态': record.status,
            '问题数量': record.issues.length,
            '问题描述': record.issues.map(i => `${i.type}: ${i.description}`).join('; '),
            '差错编号': record.errorNumber || '',
            '创建时间': record.createdAt,
            '更新时间': record.updatedAt,
            '处理历史': record.processingHistory.map(h => `${h.status} - ${h.handledBy} - ${h.handledAt}${h.comment ? ` (${h.comment})` : ''}`).join(' | ')
        }));
        const parser = new json2csv_1.Parser();
        const csv = parser.parse(exportData);
        return Buffer.from(csv, 'utf-8');
    }
    async getRecordById(recordId) {
        const records = await FileStorage_1.storage.getRecords();
        return records.find(r => r.id === recordId);
    }
    async getBatchById(batchId) {
        const batches = await FileStorage_1.storage.getBatches();
        return batches.find(b => b.id === batchId);
    }
    async getAllBatches() {
        return FileStorage_1.storage.getBatches();
    }
    async getTellers() {
        return FileStorage_1.storage.getTellers();
    }
    async getSchedules() {
        return FileStorage_1.storage.getSchedules();
    }
    async saveTellers(tellers) {
        await FileStorage_1.storage.saveTellers(tellers);
    }
    async saveSchedules(schedules) {
        await FileStorage_1.storage.saveSchedules(schedules);
    }
}
exports.TransferService = TransferService;
exports.transferService = new TransferService();
