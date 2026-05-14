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
exports.Storage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
const DATA_DIR = path.join(process.cwd(), 'data');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
class Storage {
    static ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }
    static ensureFile(filePath, defaultContent) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, defaultContent, 'utf8');
        }
    }
    static loadRecords() {
        this.ensureDataDir();
        this.ensureFile(RECORDS_FILE, '[]');
        const content = fs.readFileSync(RECORDS_FILE, 'utf8');
        return JSON.parse(content);
    }
    static saveRecords(records) {
        this.ensureDataDir();
        fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2), 'utf8');
    }
    static loadBatches() {
        this.ensureDataDir();
        this.ensureFile(BATCHES_FILE, '[]');
        const content = fs.readFileSync(BATCHES_FILE, 'utf8');
        return JSON.parse(content);
    }
    static saveBatches(batches) {
        this.ensureDataDir();
        fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2), 'utf8');
    }
    static addRecord(record) {
        const records = this.loadRecords();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        records.push(newRecord);
        this.saveRecords(records);
        this.updateBatchStats(record.batchId);
        return newRecord;
    }
    static updateRecord(id, updates) {
        const records = this.loadRecords();
        const index = records.findIndex(r => r.id === id);
        if (index === -1)
            return null;
        records[index] = {
            ...records[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveRecords(records);
        this.updateBatchStats(records[index].batchId);
        return records[index];
    }
    static getRecordById(id) {
        return this.loadRecords().find(r => r.id === id);
    }
    static queryRecords(options) {
        let records = this.loadRecords();
        if (options.batchId) {
            records = records.filter(r => r.batchId === options.batchId);
        }
        if (options.status) {
            records = records.filter(r => r.status === options.status);
        }
        if (options.abnormalType) {
            records = records.filter(r => r.abnormalType === options.abnormalType);
        }
        if (options.startDate) {
            records = records.filter(r => r.createdAt >= options.startDate);
        }
        if (options.endDate) {
            records = records.filter(r => r.createdAt <= options.endDate);
        }
        if (options.keyword) {
            const keyword = options.keyword.toLowerCase();
            records = records.filter(r => r.customerName.toLowerCase().includes(keyword) ||
                r.agentName.toLowerCase().includes(keyword) ||
                r.summary.toLowerCase().includes(keyword) ||
                r.recordingId.toLowerCase().includes(keyword));
        }
        return records;
    }
    static addBatch(batch) {
        const batches = this.loadBatches();
        const newBatch = {
            ...batch,
            createdAt: new Date().toISOString()
        };
        batches.push(newBatch);
        this.saveBatches(batches);
        return newBatch;
    }
    static getBatchById(batchId) {
        return this.loadBatches().find(b => b.batchId === batchId);
    }
    static updateBatchStats(batchId) {
        const records = this.loadRecords().filter(r => r.batchId === batchId);
        const batches = this.loadBatches();
        const batchIndex = batches.findIndex(b => b.batchId === batchId);
        if (batchIndex !== -1) {
            batches[batchIndex] = {
                ...batches[batchIndex],
                totalRecords: records.length,
                successCount: records.filter(r => r.status === types_1.ProcessingStatus.SUCCESS).length,
                abnormalCount: records.filter(r => r.status === types_1.ProcessingStatus.ABNORMAL).length,
                pendingCount: records.filter(r => r.status === types_1.ProcessingStatus.PENDING).length,
                correctedCount: records.filter(r => r.status === types_1.ProcessingStatus.MANUALLY_CORRECTED).length,
                processedAt: new Date().toISOString()
            };
            this.saveBatches(batches);
        }
    }
    static getAllBatches() {
        return this.loadBatches();
    }
    static manuallyCorrectRecord(recordId, correctedBy, correctionReason, updates) {
        return this.updateRecord(recordId, {
            ...updates,
            status: types_1.ProcessingStatus.MANUALLY_CORRECTED,
            correctedBy,
            correctionReason,
            correctionTime: new Date().toISOString()
        });
    }
}
exports.Storage = Storage;
