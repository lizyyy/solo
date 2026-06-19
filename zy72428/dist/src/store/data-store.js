"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = exports.DataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.trackAliases = new Map();
        this.sessionPhotos = new Map();
        this.scheduleRecords = new Map();
        this.checklist = new Map();
        this.workflowStates = new Map();
        this.importBatches = new Set();
        this.auditLog = [];
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    generateBatchId() {
        const batchId = `batch-${Date.now()}-${(0, uuid_1.v4)().slice(0, 8)}`;
        this.importBatches.add(batchId);
        return batchId;
    }
    isBatchExists(batchId) {
        return this.importBatches.has(batchId);
    }
    addAuditEntry(entry) {
        this.auditLog.push(entry);
    }
    getAuditLog(entityType, entityId) {
        let entries = this.auditLog;
        if (entityType) {
            entries = entries.filter((e) => e.entityType === entityType);
        }
        if (entityId) {
            entries = entries.filter((e) => e.entityId === entityId);
        }
        return entries;
    }
    getAuditLogByBatch(batchId) {
        return this.auditLog.filter((e) => e.batchId === batchId);
    }
    saveTrackAlias(alias) {
        this.trackAliases.set(alias.id, alias);
    }
    getTrackAlias(id) {
        return this.trackAliases.get(id);
    }
    getAllTrackAliases() {
        return Array.from(this.trackAliases.values());
    }
    findTrackAliasByName(name) {
        const normalized = name.trim().toLowerCase();
        return Array.from(this.trackAliases.values()).find((a) => a.canonicalName.trim().toLowerCase() === normalized ||
            a.aliases.some((alias) => alias.trim().toLowerCase() === normalized));
    }
    findDuplicateAlias(canonicalName, aliases) {
        const normalizedCanonical = canonicalName.trim().toLowerCase();
        const normalizedAliases = aliases.map((a) => a.trim().toLowerCase());
        return Array.from(this.trackAliases.values()).find((existing) => {
            if (existing.canonicalName.trim().toLowerCase() === normalizedCanonical) {
                return true;
            }
            return existing.aliases.some((a) => normalizedAliases.includes(a.trim().toLowerCase()) ||
                normalizedAliases.includes(existing.canonicalName.trim().toLowerCase()));
        });
    }
    saveSessionPhoto(photo) {
        this.sessionPhotos.set(photo.id, photo);
    }
    getSessionPhoto(id) {
        return this.sessionPhotos.get(id);
    }
    getAllSessionPhotos() {
        return Array.from(this.sessionPhotos.values());
    }
    getSessionPhotosBySource(source) {
        return Array.from(this.sessionPhotos.values()).filter((p) => p.source === source);
    }
    saveScheduleRecord(record) {
        this.scheduleRecords.set(record.id, record);
    }
    getScheduleRecord(id) {
        return this.scheduleRecords.get(id);
    }
    getAllScheduleRecords() {
        return Array.from(this.scheduleRecords.values());
    }
    getScheduleRecordsByBatch(batchId) {
        return Array.from(this.scheduleRecords.values()).filter((r) => r.importBatchId === batchId);
    }
    findDuplicateScheduleRecords(record) {
        return Array.from(this.scheduleRecords.values()).filter((r) => r.performerId === record.performerId &&
            r.sessionDate.getTime() === record.sessionDate?.getTime() &&
            r.locationId === record.locationId &&
            r.trackName === record.trackName);
    }
    saveChecklistItem(item) {
        this.checklist.set(item.id, item);
    }
    getChecklistItem(id) {
        return this.checklist.get(id);
    }
    getAllChecklistItems() {
        return Array.from(this.checklist.values());
    }
    getChecklistItemsBySource(source) {
        return Array.from(this.checklist.values()).filter((c) => c.source === source);
    }
    saveWorkflowState(state) {
        this.workflowStates.set(state.batchId, state);
    }
    getWorkflowState(batchId) {
        return this.workflowStates.get(batchId);
    }
    getAllWorkflowStates() {
        return Array.from(this.workflowStates.values());
    }
    clear() {
        this.trackAliases.clear();
        this.sessionPhotos.clear();
        this.scheduleRecords.clear();
        this.checklist.clear();
        this.workflowStates.clear();
        this.importBatches.clear();
        this.auditLog = [];
    }
}
exports.DataStore = DataStore;
exports.dataStore = new DataStore();
