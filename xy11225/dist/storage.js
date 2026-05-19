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
exports.storage = exports.Storage = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const STORAGE_DIR = path.join(process.cwd(), '.bso-storage');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');
class Storage {
    constructor() {
        this.ensureStorageExists();
        this.data = this.loadData();
    }
    ensureStorageExists() {
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }
    }
    loadData() {
        if (fs.existsSync(DATA_FILE)) {
            try {
                const content = fs.readFileSync(DATA_FILE, 'utf-8');
                return JSON.parse(content);
            }
            catch (error) {
                console.warn('存储文件损坏，重新初始化');
            }
        }
        return {
            records: [],
            batches: [],
            cabinets: {}
        };
    }
    saveData() {
        fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    addRecord(record) {
        const now = new Date().toISOString();
        const newRecord = {
            ...record,
            id: this.generateId(),
            createdAt: now,
            updatedAt: now
        };
        this.data.records.push(newRecord);
        this.saveData();
        return newRecord;
    }
    updateRecord(id, updates) {
        const index = this.data.records.findIndex(r => r.id === id);
        if (index === -1)
            return null;
        this.data.records[index] = {
            ...this.data.records[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveData();
        return this.data.records[index];
    }
    getRecord(id) {
        return this.data.records.find(r => r.id === id);
    }
    getRecords(filter) {
        let records = [...this.data.records];
        if (filter) {
            if (filter.handler) {
                records = records.filter(r => r.handler === filter.handler);
            }
            if (filter.cabinetId) {
                records = records.filter(r => r.cabinetId === filter.cabinetId);
            }
            if (filter.status) {
                records = records.filter(r => r.status === filter.status);
            }
            if (filter.faultType) {
                records = records.filter(r => r.faultType === filter.faultType);
            }
            if (filter.startDate) {
                records = records.filter(r => r.createdAt >= filter.startDate);
            }
            if (filter.endDate) {
                records = records.filter(r => r.createdAt <= filter.endDate);
            }
        }
        return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    getRecordsByCabinet(cabinetId) {
        return this.data.records.filter(r => r.cabinetId === cabinetId);
    }
    deleteRecord(id) {
        const index = this.data.records.findIndex(r => r.id === id);
        if (index === -1)
            return false;
        this.data.records.splice(index, 1);
        this.saveData();
        return true;
    }
    setCabinetOffline(cabinetId, isOffline) {
        if (!this.data.cabinets[cabinetId]) {
            this.data.cabinets[cabinetId] = { isOffline: false };
        }
        this.data.cabinets[cabinetId].isOffline = isOffline;
        this.data.cabinets[cabinetId].lastMaintenanceAt = new Date().toISOString();
        this.saveData();
    }
    isCabinetOffline(cabinetId) {
        return this.data.cabinets[cabinetId]?.isOffline || false;
    }
    addBatchResult(batch) {
        const newBatch = {
            ...batch,
            batchId: this.generateId(),
            createdAt: new Date().toISOString()
        };
        this.data.batches.push(newBatch);
        this.saveData();
        return newBatch;
    }
    getBatchResult(batchId) {
        return this.data.batches.find(b => b.batchId === batchId);
    }
    getAllBatches() {
        return [...this.data.batches];
    }
    getStatistics() {
        return {
            totalRecords: this.data.records.length,
            pendingRecords: this.data.records.filter(r => r.status === '待处理').length,
            resolvedRecords: this.data.records.filter(r => r.status === '已解决').length,
            offlineCabinets: Object.values(this.data.cabinets).filter(c => c.isOffline).length,
            totalBatches: this.data.batches.length
        };
    }
}
exports.Storage = Storage;
exports.storage = new Storage();
