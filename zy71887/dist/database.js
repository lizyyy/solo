"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
class Database {
    constructor() {
        this.records = new Map();
        this.history = [];
        this.batches = [];
        this.calibration = null;
        this.ensureDataDir();
        this.loadAll();
    }
    ensureDataDir() {
        if (!fs_1.default.existsSync(DATA_DIR)) {
            fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
        }
    }
    loadAll() {
        this.loadRecords();
        this.loadHistory();
        this.loadBatches();
        this.loadCalibration();
    }
    loadRecords() {
        const recordsPath = path_1.default.join(DATA_DIR, 'records.json');
        if (fs_1.default.existsSync(recordsPath)) {
            const data = JSON.parse(fs_1.default.readFileSync(recordsPath, 'utf-8'));
            this.records = new Map(data.map((r) => [r.id, r]));
        }
    }
    loadHistory() {
        const historyPath = path_1.default.join(DATA_DIR, 'history.json');
        if (fs_1.default.existsSync(historyPath)) {
            this.history = JSON.parse(fs_1.default.readFileSync(historyPath, 'utf-8'));
        }
    }
    loadBatches() {
        const batchesPath = path_1.default.join(DATA_DIR, 'batches.json');
        if (fs_1.default.existsSync(batchesPath)) {
            this.batches = JSON.parse(fs_1.default.readFileSync(batchesPath, 'utf-8'));
        }
    }
    loadCalibration() {
        const calPath = path_1.default.join(DATA_DIR, 'calibration.json');
        if (fs_1.default.existsSync(calPath)) {
            this.calibration = JSON.parse(fs_1.default.readFileSync(calPath, 'utf-8'));
        }
    }
    saveRecords() {
        const recordsPath = path_1.default.join(DATA_DIR, 'records.json');
        fs_1.default.writeFileSync(recordsPath, JSON.stringify(Array.from(this.records.values()), null, 2), 'utf-8');
    }
    saveHistory() {
        const historyPath = path_1.default.join(DATA_DIR, 'history.json');
        fs_1.default.writeFileSync(historyPath, JSON.stringify(this.history, null, 2), 'utf-8');
    }
    saveBatches() {
        const batchesPath = path_1.default.join(DATA_DIR, 'batches.json');
        fs_1.default.writeFileSync(batchesPath, JSON.stringify(this.batches, null, 2), 'utf-8');
    }
    saveCalibration(calibration) {
        this.calibration = calibration;
        const calPath = path_1.default.join(DATA_DIR, 'calibration.json');
        fs_1.default.writeFileSync(calPath, JSON.stringify(calibration, null, 2), 'utf-8');
    }
    getCalibration() {
        return this.calibration;
    }
    addRecord(record, operator, reason) {
        const existing = this.records.get(record.id);
        if (existing) {
            const changes = this.compareRecords(existing, record);
            if (changes.length > 0) {
                this.addHistoryEntry({
                    id: this.generateId(),
                    recordId: record.id,
                    action: 'update',
                    timestamp: new Date().toISOString(),
                    operator,
                    changes,
                    reason
                });
            }
        }
        else {
            this.addHistoryEntry({
                id: this.generateId(),
                recordId: record.id,
                action: 'import',
                timestamp: new Date().toISOString(),
                operator,
                changes: [{ field: 'record', oldValue: null, newValue: record.id }],
                reason
            });
        }
        this.records.set(record.id, record);
        this.saveRecords();
    }
    compareRecords(oldRecord, newRecord) {
        const changes = [];
        const compareObject = (oldObj, newObj, prefix = '') => {
            const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
            for (const key of allKeys) {
                const field = prefix ? `${prefix}.${key}` : key;
                const oldVal = oldObj?.[key];
                const newVal = newObj?.[key];
                if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal !== null && newVal !== null) {
                    compareObject(oldVal, newVal, field);
                }
                else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    changes.push({ field, oldValue: oldVal, newValue: newVal });
                }
            }
        };
        compareObject(oldRecord.rawData, newRecord.rawData, 'rawData');
        compareObject(oldRecord.student, newRecord.student, 'student');
        return changes;
    }
    addHistoryEntry(entry) {
        this.history.push(entry);
        this.saveHistory();
    }
    getRecord(id) {
        return this.records.get(id);
    }
    getAllRecords() {
        return Array.from(this.records.values());
    }
    filterRecords(criteria) {
        return this.getAllRecords().filter(record => {
            if (criteria.studentId && !record.student.studentId.includes(criteria.studentId))
                return false;
            if (criteria.studentName && !record.student.studentName.includes(criteria.studentName))
                return false;
            if (criteria.groupId && record.student.groupId !== criteria.groupId)
                return false;
            if (criteria.experimentDateFrom && record.student.experimentDate < criteria.experimentDateFrom)
                return false;
            if (criteria.experimentDateTo && record.student.experimentDate > criteria.experimentDateTo)
                return false;
            if (criteria.status?.length && !criteria.status.includes(record.status))
                return false;
            if (criteria.hasAnomalies !== undefined) {
                const hasAnomalies = record.anomalies.length > 0;
                if (criteria.hasAnomalies !== hasAnomalies)
                    return false;
            }
            if (criteria.anomalyTypes?.length) {
                const hasType = record.anomalies.some(a => criteria.anomalyTypes.includes(a.type));
                if (!hasType)
                    return false;
            }
            if (criteria.minScore !== undefined && (!record.grading || record.grading.score < criteria.minScore))
                return false;
            if (criteria.maxScore !== undefined && (record.grading && record.grading.score > criteria.maxScore))
                return false;
            if (criteria.importBatchId && record.importBatchId !== criteria.importBatchId)
                return false;
            return true;
        });
    }
    addBatch(batch) {
        this.batches.push(batch);
        this.saveBatches();
    }
    getBatches() {
        return this.batches;
    }
    getBatch(id) {
        return this.batches.find(b => b.id === id);
    }
    rollbackBatch(batchId, operator, reason) {
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch)
            throw new Error(`批次 ${batchId} 不存在`);
        const recordsToRollback = this.getAllRecords().filter(r => r.importBatchId === batchId);
        for (const record of recordsToRollback) {
            this.records.delete(record.id);
            this.addHistoryEntry({
                id: this.generateId(),
                recordId: record.id,
                action: 'withdraw',
                timestamp: new Date().toISOString(),
                operator,
                changes: [{ field: 'status', oldValue: record.status, newValue: 'withdrawn' }],
                reason
            });
        }
        batch.status = 'rolled_back';
        batch.rollbackReason = reason;
        this.saveRecords();
        this.saveBatches();
    }
    gradeRecord(recordId, grading, operator) {
        const record = this.records.get(recordId);
        if (!record)
            throw new Error(`记录 ${recordId} 不存在`);
        const changes = [];
        if (record.grading) {
            if (record.grading.score !== grading.score) {
                changes.push({ field: 'grading.score', oldValue: record.grading.score, newValue: grading.score });
            }
            if (record.grading.comments !== grading.comments) {
                changes.push({ field: 'grading.comments', oldValue: record.grading.comments, newValue: grading.comments });
            }
        }
        else {
            changes.push({ field: 'grading', oldValue: null, newValue: 'added' });
        }
        if (changes.length > 0) {
            this.addHistoryEntry({
                id: this.generateId(),
                recordId,
                action: 'grade',
                timestamp: new Date().toISOString(),
                operator,
                changes
            });
        }
        if (record.grading) {
            grading.previousScore = record.grading.score;
            grading.previousComments = record.grading.comments;
        }
        record.grading = grading;
        record.status = 'graded';
        record.updatedAt = new Date().toISOString();
        record.version++;
        this.saveRecords();
    }
    getRecordHistory(recordId) {
        return this.history.filter(h => h.recordId === recordId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    getAllHistory() {
        return this.history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    updateRecordStatus(recordId, status, operator, reason) {
        const record = this.records.get(recordId);
        if (!record)
            throw new Error(`记录 ${recordId} 不存在`);
        if (record.status !== status) {
            this.addHistoryEntry({
                id: this.generateId(),
                recordId,
                action: status === 'withdrawn' ? 'withdraw' : 'update',
                timestamp: new Date().toISOString(),
                operator,
                changes: [{ field: 'status', oldValue: record.status, newValue: status }],
                reason
            });
            record.status = status;
            record.updatedAt = new Date().toISOString();
            record.version++;
            this.saveRecords();
        }
    }
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    getDataDir() {
        return DATA_DIR;
    }
}
exports.Database = Database;
