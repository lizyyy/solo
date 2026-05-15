"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeIndexDB = void 0;
exports.createDB = createDB;
const lowdb_1 = require("lowdb");
const node_1 = require("lowdb/node");
const path_1 = __importDefault(require("path"));
const defaultData = {
    batches: [],
    records: [],
    corrections: []
};
class ChangeIndexDB {
    db;
    constructor(dbPath) {
        const dbFile = dbPath || path_1.default.join(process.cwd(), 'change-index.json');
        const adapter = new node_1.JSONFile(dbFile);
        this.db = new lowdb_1.Low(adapter, defaultData);
    }
    async init() {
        await this.db.read();
        if (!this.db.data) {
            this.db.data = { ...defaultData };
            await this.db.write();
        }
    }
    async insertBatch(batch) {
        this.db.data.batches.push(batch);
        await this.db.write();
    }
    async insertRecord(record) {
        this.db.data.records.push(record);
        await this.db.write();
    }
    async insertCorrection(correction) {
        this.db.data.corrections.push(correction);
        await this.db.write();
    }
    async updateRecord(record) {
        const index = this.db.data.records.findIndex(r => r.id === record.id);
        if (index !== -1) {
            this.db.data.records[index] = record;
            await this.db.write();
        }
    }
    getRecords(filter = {}) {
        let records = [...this.db.data.records];
        if (filter.batchId) {
            records = records.filter(r => r.batchId === filter.batchId);
        }
        if (filter.operator) {
            records = records.filter(r => r.operator === filter.operator);
        }
        if (filter.riskType) {
            records = records.filter(r => r.riskType === filter.riskType);
        }
        if (filter.status) {
            records = records.filter(r => r.status === filter.status);
        }
        if (filter.startDate) {
            records = records.filter(r => r.createdAt >= filter.startDate);
        }
        if (filter.endDate) {
            records = records.filter(r => r.createdAt <= filter.endDate);
        }
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return records;
    }
    getRecordById(id) {
        return this.db.data.records.find(r => r.id === id) || null;
    }
    getBatches() {
        return [...this.db.data.batches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    getBatchById(id) {
        return this.db.data.batches.find(b => b.id === id) || null;
    }
    getCorrectionsByRecordId(recordId) {
        return this.db.data.corrections
            .filter(c => c.recordId === recordId)
            .sort((a, b) => new Date(a.correctedAt).getTime() - new Date(b.correctedAt).getTime());
    }
    getCorrectionsByApprovalNode(approvalNode) {
        return this.db.data.corrections
            .filter(c => c.approvalNode === approvalNode)
            .sort((a, b) => new Date(b.correctedAt).getTime() - new Date(a.correctedAt).getTime());
    }
    close() {
        // lowdb 不需要显式关闭
    }
}
exports.ChangeIndexDB = ChangeIndexDB;
async function createDB(dbPath) {
    const db = new ChangeIndexDB(dbPath);
    await db.init();
    return db;
}
