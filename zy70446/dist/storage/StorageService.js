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
exports.StorageService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
class StorageService {
    constructor(dataDir = './data') {
        this.dataPath = path.join(dataDir, 'audit-data.json');
        this.ensureDataDir(dataDir);
        this.data = this.loadData();
    }
    ensureDataDir(dataDir) {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }
    loadData() {
        if (fs.existsSync(this.dataPath)) {
            try {
                const content = fs.readFileSync(this.dataPath, 'utf-8');
                return JSON.parse(content);
            }
            catch (e) {
                console.warn('存储文件损坏，重新初始化');
            }
        }
        return {
            records: {},
            idToHash: {},
            handlerIndex: {}
        };
    }
    saveData() {
        fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
    }
    hashContent(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
    saveAuditResult(result, handler) {
        const contentHash = this.hashContent(result.item.content);
        if (this.data.records[contentHash]) {
            const existingRecord = this.data.records[contentHash];
            const isConflicting = existingRecord.result.overallDecision !== result.overallDecision;
            return {
                isDuplicate: true,
                isConflicting,
                existingRecord
            };
        }
        const record = {
            result,
            corrections: [],
            status: 'pending',
            handler,
            auditTimestamp: Date.now()
        };
        this.data.records[contentHash] = record;
        this.data.idToHash[result.itemId] = contentHash;
        if (handler) {
            if (!this.data.handlerIndex[handler]) {
                this.data.handlerIndex[handler] = [];
            }
            if (!this.data.handlerIndex[handler].includes(result.itemId)) {
                this.data.handlerIndex[handler].push(result.itemId);
            }
        }
        this.saveData();
        return { isDuplicate: false, isConflicting: false, newRecord: record };
    }
    forceUpdateAuditResult(result, handler) {
        const contentHash = this.hashContent(result.item.content);
        const previousRecord = this.data.records[contentHash];
        const newRecord = {
            result,
            corrections: [],
            status: 'pending',
            handler,
            auditTimestamp: Date.now()
        };
        this.data.records[contentHash] = newRecord;
        this.data.idToHash[result.itemId] = contentHash;
        if (handler) {
            if (!this.data.handlerIndex[handler]) {
                this.data.handlerIndex[handler] = [];
            }
            if (!this.data.handlerIndex[handler].includes(result.itemId)) {
                this.data.handlerIndex[handler].push(result.itemId);
            }
        }
        this.saveData();
        const isConflicting = previousRecord ? previousRecord.result.overallDecision !== result.overallDecision : false;
        return {
            isConflicting,
            previousRecord,
            newRecord
        };
    }
    getRecordByItemId(itemId) {
        const hash = this.data.idToHash[itemId];
        return hash ? this.data.records[hash] : undefined;
    }
    getRecordByContent(content) {
        const hash = this.hashContent(content);
        return this.data.records[hash];
    }
    addManualCorrection(itemId, handler, newDecision, remark) {
        const record = this.getRecordByItemId(itemId);
        if (!record) {
            return { success: false, error: '未找到对应的审核记录' };
        }
        const correction = {
            id: (0, uuid_1.v4)(),
            resultId: itemId,
            handler,
            originalDecision: record.result.overallDecision,
            newDecision,
            remark,
            timestamp: Date.now()
        };
        record.corrections.push(correction);
        record.status = 'corrected';
        record.finalDecision = newDecision;
        const contentHash = this.data.idToHash[itemId];
        this.data.records[contentHash] = record;
        if (!this.data.handlerIndex[handler]) {
            this.data.handlerIndex[handler] = [];
        }
        if (!this.data.handlerIndex[handler].includes(itemId)) {
            this.data.handlerIndex[handler].push(itemId);
        }
        this.saveData();
        return { success: true, record };
    }
    confirmRecord(itemId, handler) {
        const record = this.getRecordByItemId(itemId);
        if (!record) {
            return { success: false, error: '未找到对应的审核记录' };
        }
        record.status = 'confirmed';
        record.finalDecision = record.result.overallDecision;
        if (handler) {
            record.handler = handler;
            if (!this.data.handlerIndex[handler]) {
                this.data.handlerIndex[handler] = [];
            }
            if (!this.data.handlerIndex[handler].includes(itemId)) {
                this.data.handlerIndex[handler].push(itemId);
            }
        }
        const contentHash = this.data.idToHash[itemId];
        this.data.records[contentHash] = record;
        this.saveData();
        return { success: true, record };
    }
    queryByHandler(handler) {
        const indexedItemIds = this.data.handlerIndex[handler] || [];
        const indexedRecords = indexedItemIds
            .map(id => this.getRecordByItemId(id))
            .filter((r) => r !== undefined);
        const allRecords = this.getAllRecords();
        const handlerFieldMatches = allRecords.filter(r => r.handler === handler);
        const mergedMap = new Map();
        for (const record of indexedRecords) {
            mergedMap.set(record.result.itemId, record);
        }
        for (const record of handlerFieldMatches) {
            mergedMap.set(record.result.itemId, record);
        }
        return Array.from(mergedMap.values());
    }
    queryByStatus(status) {
        return Object.values(this.data.records).filter(r => r.status === status);
    }
    queryByDecision(decision) {
        return Object.values(this.data.records).filter(r => {
            const finalDecision = r.finalDecision || r.result.overallDecision;
            return finalDecision === decision;
        });
    }
    getAllRecords() {
        return Object.values(this.data.records);
    }
    getStats() {
        const records = this.getAllRecords();
        return {
            total: records.length,
            pending: records.filter(r => r.status === 'pending').length,
            confirmed: records.filter(r => r.status === 'confirmed').length,
            corrected: records.filter(r => r.status === 'corrected').length,
            pass: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'pass').length,
            reject: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'reject').length,
            review: records.filter(r => (r.finalDecision || r.result.overallDecision) === 'review').length
        };
    }
    checkDuplicates(items) {
        const duplicates = [];
        const newItems = [];
        for (const item of items) {
            const existing = this.getRecordByContent(item.content);
            if (existing) {
                duplicates.push({ item, existingRecord: existing });
            }
            else {
                newItems.push(item);
            }
        }
        return { duplicates, newItems };
    }
}
exports.StorageService = StorageService;
