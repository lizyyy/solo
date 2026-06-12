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
exports.defaultStore = exports.ReconciliationStore = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const types_1 = require("../types");
const DEFAULT_DATA_FILE = path.join(process.cwd(), 'data', 'reconciliation-state.json');
class ReconciliationStore {
    constructor(dataFile) {
        this.dataFile = dataFile || DEFAULT_DATA_FILE;
        this.state = this.loadState();
    }
    loadState() {
        const dir = path.dirname(this.dataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(this.dataFile)) {
            try {
                const content = fs.readFileSync(this.dataFile, 'utf-8');
                return JSON.parse(content);
            }
            catch (e) {
                console.warn('状态文件损坏，使用空状态初始化');
            }
        }
        return {
            groupRecords: [],
            contractRecords: [],
            results: [],
            logs: [],
            batches: [],
            lastUpdated: new Date().toISOString()
        };
    }
    saveState() {
        this.state.lastUpdated = new Date().toISOString();
        const dir = path.dirname(this.dataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.dataFile, JSON.stringify(this.state, null, 2), 'utf-8');
    }
    logOperation(operationType, entityType, entityId, operator, oldState, newState, batchId, notes) {
        const deepClone = (obj) => {
            if (obj === undefined)
                return undefined;
            try {
                return JSON.parse(JSON.stringify(obj));
            }
            catch (e) {
                return String(obj);
            }
        };
        const log = {
            id: (0, uuid_1.v4)(),
            operationType,
            entityType,
            entityId,
            oldState: deepClone(oldState),
            newState: deepClone(newState),
            operator,
            timestamp: new Date().toISOString(),
            batchId,
            notes
        };
        this.state.logs.push(log);
    }
    getState() {
        return this.state;
    }
    addGroupRecords(records, batchId, operator) {
        const newRecords = records.map((r) => ({
            ...r,
            id: (0, uuid_1.v4)(),
            importedAt: new Date().toISOString(),
            status: types_1.RecordStatus.IMPORTED,
            manualEdits: []
        }));
        this.state.groupRecords.push(...newRecords);
        const batch = this.state.batches.find((b) => b.id === batchId);
        if (batch)
            batch.recordCount = newRecords.length;
        this.logOperation('BULK_IMPORT', 'GroupSignupRecord', undefined, operator, undefined, { count: newRecords.length }, batchId);
        this.saveState();
        return newRecords;
    }
    addContractRecords(records, batchId, operator) {
        const newRecords = records.map((r) => ({
            ...r,
            id: (0, uuid_1.v4)(),
            importedAt: new Date().toISOString(),
            status: types_1.RecordStatus.IMPORTED,
            manualEdits: []
        }));
        this.state.contractRecords.push(...newRecords);
        const cbatch = this.state.batches.find((b) => b.id === batchId);
        if (cbatch)
            cbatch.recordCount = newRecords.length;
        this.logOperation('BULK_IMPORT', 'ContractRecord', undefined, operator, undefined, { count: newRecords.length }, batchId);
        this.saveState();
        return newRecords;
    }
    addBatch(batch) {
        const newBatch = {
            ...batch,
            id: (0, uuid_1.v4)(),
            importedAt: new Date().toISOString()
        };
        this.state.batches.push(newBatch);
        this.logOperation('CREATE_BATCH', 'ImportBatch', newBatch.id, batch.operator, undefined, newBatch);
        this.saveState();
        return newBatch;
    }
    addResult(result, operator) {
        const now = new Date().toISOString();
        const newResult = {
            ...result,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        this.state.results.push(newResult);
        this.logOperation('CREATE_RESULT', 'ReconciliationResult', newResult.id, operator, undefined, newResult);
        this.saveState();
        return newResult;
    }
    updateResult(resultId, updates, operator, notes) {
        const idx = this.state.results.findIndex((r) => r.id === resultId);
        if (idx === -1)
            return undefined;
        const oldState = { ...this.state.results[idx] };
        this.state.results[idx] = {
            ...this.state.results[idx],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.logOperation('UPDATE_RESULT', 'ReconciliationResult', resultId, operator, oldState, this.state.results[idx], undefined, notes);
        this.saveState();
        return this.state.results[idx];
    }
    updateGroupRecord(recordId, updates, operator, editReason) {
        const idx = this.state.groupRecords.findIndex((r) => r.id === recordId);
        if (idx === -1)
            return undefined;
        const oldState = { ...this.state.groupRecords[idx] };
        const now = new Date().toISOString();
        const manualEdits = Object.entries(updates)
            .filter(([key]) => key !== 'status' && key !== 'manualEdits')
            .map(([fieldName, newValue]) => ({
            id: (0, uuid_1.v4)(),
            fieldName,
            oldValue: String(oldState[fieldName] || ''),
            newValue: String(newValue || ''),
            editedBy: operator,
            editedAt: now,
            reason: editReason
        }));
        this.state.groupRecords[idx] = {
            ...this.state.groupRecords[idx],
            ...updates,
            manualEdits: [...this.state.groupRecords[idx].manualEdits, ...manualEdits]
        };
        this.logOperation('UPDATE_GROUP_RECORD', 'GroupSignupRecord', recordId, operator, oldState, this.state.groupRecords[idx]);
        this.saveState();
        return this.state.groupRecords[idx];
    }
    updateContractRecord(recordId, updates, operator, editReason) {
        const idx = this.state.contractRecords.findIndex((r) => r.id === recordId);
        if (idx === -1)
            return undefined;
        const oldState = { ...this.state.contractRecords[idx] };
        const now = new Date().toISOString();
        const manualEdits = Object.entries(updates)
            .filter(([key]) => key !== 'status' && key !== 'manualEdits')
            .map(([fieldName, newValue]) => ({
            id: (0, uuid_1.v4)(),
            fieldName,
            oldValue: String(oldState[fieldName] || ''),
            newValue: String(newValue || ''),
            editedBy: operator,
            editedAt: now,
            reason: editReason
        }));
        this.state.contractRecords[idx] = {
            ...this.state.contractRecords[idx],
            ...updates,
            manualEdits: [...this.state.contractRecords[idx].manualEdits, ...manualEdits]
        };
        this.logOperation('UPDATE_CONTRACT_RECORD', 'ContractRecord', recordId, operator, oldState, this.state.contractRecords[idx]);
        this.saveState();
        return this.state.contractRecords[idx];
    }
    findGroupRecordByRowAndBatch(rowNumber, batchId) {
        return this.state.groupRecords.find((r) => r.originalRowNumber === rowNumber && r.importBatchId === batchId);
    }
    getResultsWithDetails(options = {}) {
        const { includeSuperseded = false } = options;
        const activeResults = includeSuperseded
            ? this.state.results
            : this.state.results.filter((r) => r.status !== types_1.RecordStatus.SUPERSEDED);
        return activeResults.map((result) => ({
            result,
            groupRecord: this.state.groupRecords.find((g) => g.id === result.groupRecordId),
            contractRecord: this.state.contractRecords.find((c) => c.id === result.contractRecordId)
        }));
    }
    getLogsForEntity(entityId) {
        return this.state.logs.filter((l) => l.entityId === entityId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }
    exportState() {
        return JSON.parse(JSON.stringify(this.state));
    }
    resetState(operator) {
        const oldState = { ...this.state };
        this.state = {
            groupRecords: [],
            contractRecords: [],
            results: [],
            logs: [],
            batches: [],
            lastUpdated: new Date().toISOString()
        };
        this.logOperation('RESET_STATE', 'ReconciliationState', undefined, operator, oldState, this.state);
        this.saveState();
    }
    rollbackBatch(batchId, operator, reason) {
        const batch = this.state.batches.find((b) => b.id === batchId);
        if (!batch) {
            throw new Error(`批次不存在: ${batchId}`);
        }
        let affectedGroupRecords = 0;
        let affectedContractRecords = 0;
        let affectedResults = 0;
        const groupRecordIds = new Set();
        const contractRecordIds = new Set();
        for (let i = 0; i < this.state.groupRecords.length; i++) {
            if (this.state.groupRecords[i].importBatchId === batchId && this.state.groupRecords[i].status !== types_1.RecordStatus.SUPERSEDED) {
                const oldState = { ...this.state.groupRecords[i] };
                this.state.groupRecords[i] = {
                    ...this.state.groupRecords[i],
                    status: types_1.RecordStatus.SUPERSEDED
                };
                groupRecordIds.add(this.state.groupRecords[i].id);
                this.logOperation('ROLLBACK_BATCH', 'GroupSignupRecord', this.state.groupRecords[i].id, operator, oldState, this.state.groupRecords[i], batchId, reason);
                affectedGroupRecords++;
            }
        }
        for (let i = 0; i < this.state.contractRecords.length; i++) {
            if (this.state.contractRecords[i].importBatchId === batchId && this.state.contractRecords[i].status !== types_1.RecordStatus.SUPERSEDED) {
                const oldState = { ...this.state.contractRecords[i] };
                this.state.contractRecords[i] = {
                    ...this.state.contractRecords[i],
                    status: types_1.RecordStatus.SUPERSEDED
                };
                contractRecordIds.add(this.state.contractRecords[i].id);
                this.logOperation('ROLLBACK_BATCH', 'ContractRecord', this.state.contractRecords[i].id, operator, oldState, this.state.contractRecords[i], batchId, reason);
                affectedContractRecords++;
            }
        }
        for (let i = 0; i < this.state.results.length; i++) {
            const r = this.state.results[i];
            const affectsThis = (r.groupRecordId && groupRecordIds.has(r.groupRecordId)) ||
                (r.contractRecordId && contractRecordIds.has(r.contractRecordId));
            if (affectsThis && r.status !== types_1.RecordStatus.SUPERSEDED) {
                const oldState = { ...r };
                this.state.results[i] = {
                    ...r,
                    status: types_1.RecordStatus.SUPERSEDED,
                    updatedAt: new Date().toISOString()
                };
                this.logOperation('ROLLBACK_BATCH', 'ReconciliationResult', r.id, operator, oldState, this.state.results[i], batchId, reason);
                affectedResults++;
            }
        }
        const oldBatch = { ...batch };
        const batchIdx = this.state.batches.findIndex((b) => b.id === batchId);
        if (batchIdx !== -1) {
            this.state.batches[batchIdx].status = 'superseded';
        }
        this.logOperation('ROLLBACK_BATCH', 'ImportBatch', batchId, operator, oldBatch, { ...batch, status: 'superseded' }, batchId, reason);
        this.saveState();
        return { affectedGroupRecords, affectedContractRecords, affectedResults };
    }
}
exports.ReconciliationStore = ReconciliationStore;
exports.defaultStore = new ReconciliationStore();
//# sourceMappingURL=index.js.map