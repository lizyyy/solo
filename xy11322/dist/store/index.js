"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = exports.DataStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const config_1 = require("../config");
class DataStore {
    constructor() {
        this.records = new Map();
        this.auditLogs = [];
        this.config = { ...config_1.DEFAULT_CONFIG };
        this.ensureDataDirectory();
        this.loadData();
    }
    ensureDataDirectory() {
        const dataDir = path_1.default.dirname(config_1.DATA_PATHS.records);
        if (!fs_1.default.existsSync(dataDir)) {
            fs_1.default.mkdirSync(dataDir, { recursive: true });
        }
    }
    loadData() {
        try {
            if (fs_1.default.existsSync(config_1.DATA_PATHS.records)) {
                const data = fs_1.default.readFileSync(config_1.DATA_PATHS.records, 'utf-8');
                const records = JSON.parse(data);
                records.forEach(r => {
                    r.startTime = new Date(r.startTime);
                    r.endTime = new Date(r.endTime);
                    r.createdAt = new Date(r.createdAt);
                    r.updatedAt = new Date(r.updatedAt);
                    if (r.billedAt)
                        r.billedAt = new Date(r.billedAt);
                    if (r.reviewedAt)
                        r.reviewedAt = new Date(r.reviewedAt);
                    r.exceptions.forEach(e => {
                        e.timestamp = new Date(e.timestamp);
                    });
                    this.records.set(r.id, r);
                });
            }
        }
        catch (error) {
            console.warn('Failed to load records, starting with empty store');
        }
        try {
            if (fs_1.default.existsSync(config_1.DATA_PATHS.auditLogs)) {
                const data = fs_1.default.readFileSync(config_1.DATA_PATHS.auditLogs, 'utf-8');
                this.auditLogs = JSON.parse(data).map((log) => ({
                    ...log,
                    timestamp: new Date(log.timestamp),
                }));
            }
        }
        catch (error) {
            console.warn('Failed to load audit logs, starting with empty logs');
        }
        try {
            if (fs_1.default.existsSync(config_1.DATA_PATHS.config)) {
                const data = fs_1.default.readFileSync(config_1.DATA_PATHS.config, 'utf-8');
                this.config = { ...config_1.DEFAULT_CONFIG, ...JSON.parse(data) };
            }
        }
        catch (error) {
            console.warn('Failed to load config, using defaults');
        }
    }
    saveData() {
        const recordsArray = Array.from(this.records.values());
        fs_1.default.writeFileSync(config_1.DATA_PATHS.records, JSON.stringify(recordsArray, null, 2), 'utf-8');
        fs_1.default.writeFileSync(config_1.DATA_PATHS.auditLogs, JSON.stringify(this.auditLogs, null, 2), 'utf-8');
        fs_1.default.writeFileSync(config_1.DATA_PATHS.config, JSON.stringify(this.config, null, 2), 'utf-8');
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(config, operator) {
        this.config = { ...this.config, ...config };
        this.addAuditLog('update_config', operator, { config });
        this.saveData();
        return { ...this.config };
    }
    addRecord(record, operator) {
        const now = new Date();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
        };
        this.records.set(newRecord.id, newRecord);
        this.addAuditLog('create_record', operator, { recordId: newRecord.id, recordNo: newRecord.recordNo });
        this.saveData();
        return newRecord;
    }
    updateRecord(id, updates, operator) {
        const record = this.records.get(id);
        if (!record)
            return null;
        const updatedRecord = {
            ...record,
            ...updates,
            updatedAt: new Date(),
            updatedBy: operator,
        };
        this.records.set(id, updatedRecord);
        this.addAuditLog('update_record', operator, { recordId: id, updates });
        this.saveData();
        return updatedRecord;
    }
    getRecordById(id) {
        return this.records.get(id);
    }
    getRecordByRecordNo(recordNo) {
        return Array.from(this.records.values()).find(r => r.recordNo === recordNo);
    }
    getAllRecords() {
        return Array.from(this.records.values());
    }
    addAuditLog(action, operator, details = {}) {
        const log = {
            id: (0, uuid_1.v4)(),
            action,
            operator,
            timestamp: new Date(),
            details,
        };
        this.auditLogs.push(log);
        return log;
    }
    getAuditLogs(filter) {
        let logs = [...this.auditLogs];
        if (filter?.recordId) {
            logs = logs.filter(l => l.details.recordId === filter.recordId);
        }
        if (filter?.action) {
            logs = logs.filter(l => l.action === filter.action);
        }
        if (filter?.operator) {
            logs = logs.filter(l => l.operator === filter.operator);
        }
        return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    recordExists(recordNo) {
        return Array.from(this.records.values()).some(r => r.recordNo === recordNo);
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
