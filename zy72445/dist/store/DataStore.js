"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStore = void 0;
const uuid_1 = require("uuid");
const dayjs_1 = __importDefault(require("dayjs"));
class DataStore {
    constructor() {
        this.trackAliases = new Map();
        this.trackRemarks = new Map();
        this.checkinPhotos = new Map();
        this.rehearsalChanges = new Map();
        this.approvalRecords = new Map();
        this.changeHistories = [];
        this.importBatches = new Map();
    }
    static getInstance() {
        if (!DataStore.instance) {
            DataStore.instance = new DataStore();
        }
        return DataStore.instance;
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    now() {
        return (0, dayjs_1.default)().toISOString();
    }
    createTrackAlias(data) {
        const now = this.now();
        const trackAlias = {
            ...data,
            id: this.generateId(),
            createdAt: now,
            updatedAt: now
        };
        this.trackAliases.set(trackAlias.id, trackAlias);
        return trackAlias;
    }
    getTrackAlias(id) {
        return this.trackAliases.get(id);
    }
    getTrackAliasByTrackId(trackId) {
        return Array.from(this.trackAliases.values()).find(t => t.trackId === trackId);
    }
    getTrackAliasesByBatch(batchId) {
        return Array.from(this.trackAliases.values()).filter(t => t.importBatchId === batchId);
    }
    getAllTrackAliases() {
        return Array.from(this.trackAliases.values());
    }
    trackAliasExists(trackId, aliases) {
        return Array.from(this.trackAliases.values()).some(t => t.trackId === trackId ||
            t.aliases.some(a => aliases.includes(a)));
    }
    createTrackRemark(data) {
        const now = this.now();
        const remark = {
            ...data,
            id: this.generateId(),
            createdAt: now,
            updatedAt: now
        };
        this.trackRemarks.set(remark.id, remark);
        return remark;
    }
    updateTrackRemark(id, updates) {
        const remark = this.trackRemarks.get(id);
        if (!remark)
            return undefined;
        const updated = {
            ...remark,
            ...updates,
            updatedAt: this.now()
        };
        this.trackRemarks.set(id, updated);
        return updated;
    }
    getTrackRemark(id) {
        return this.trackRemarks.get(id);
    }
    getTrackRemarksByTrackId(trackId) {
        return Array.from(this.trackRemarks.values()).filter(r => r.trackId === trackId);
    }
    hasReworkReasonForTrack(trackId) {
        return this.getTrackRemarksByTrackId(trackId).some(r => r.hasReworkReason);
    }
    createCheckinPhoto(data) {
        const photo = {
            ...data,
            id: this.generateId(),
            uploadedAt: this.now()
        };
        this.checkinPhotos.set(photo.id, photo);
        return photo;
    }
    getCheckinPhoto(id) {
        return this.checkinPhotos.get(id);
    }
    getCheckinPhotosByTrack(trackId) {
        return Array.from(this.checkinPhotos.values()).filter(p => p.trackId === trackId);
    }
    reviewCheckinPhoto(id, reviewedBy) {
        const photo = this.checkinPhotos.get(id);
        if (!photo)
            return undefined;
        const updated = {
            ...photo,
            reviewed: true,
            reviewedBy,
            reviewedAt: this.now()
        };
        this.checkinPhotos.set(id, updated);
        return updated;
    }
    createRehearsalChange(data) {
        const record = {
            ...data,
            id: this.generateId(),
            createdAt: this.now()
        };
        this.rehearsalChanges.set(record.id, record);
        return record;
    }
    getRehearsalChangesByTrack(trackId) {
        return Array.from(this.rehearsalChanges.values()).filter(r => r.trackId === trackId);
    }
    createApprovalRecord(data) {
        const now = this.now();
        const record = {
            ...data,
            id: this.generateId(),
            createdAt: now,
            updatedAt: now
        };
        this.approvalRecords.set(record.id, record);
        return record;
    }
    updateApprovalRecord(id, updates) {
        const record = this.approvalRecords.get(id);
        if (!record)
            return undefined;
        const updated = {
            ...record,
            ...updates,
            updatedAt: this.now()
        };
        this.approvalRecords.set(id, updated);
        return updated;
    }
    getApprovalRecord(id) {
        return this.approvalRecords.get(id);
    }
    getApprovalRecordByTrackId(trackId) {
        return Array.from(this.approvalRecords.values()).find(r => r.trackId === trackId);
    }
    getAllApprovalRecords() {
        return Array.from(this.approvalRecords.values());
    }
    createImportBatch(data) {
        const batch = {
            ...data,
            id: this.generateId(),
            importedAt: this.now()
        };
        this.importBatches.set(batch.id, batch);
        return batch;
    }
    getImportBatchByIdentifier(identifier) {
        return Array.from(this.importBatches.values()).find(b => b.batchIdentifier === identifier);
    }
    getImportBatch(id) {
        return this.importBatches.get(id);
    }
    updateImportBatch(id, updates) {
        const batch = this.importBatches.get(id);
        if (!batch)
            return undefined;
        const updated = { ...batch, ...updates };
        this.importBatches.set(id, updated);
        return updated;
    }
    addChangeHistory(data) {
        const history = {
            ...data,
            id: this.generateId(),
            changedAt: this.now()
        };
        this.changeHistories.push(history);
        return history;
    }
    getChangeHistoryByEntity(entityType, entityId) {
        return this.changeHistories.filter(h => h.entityType === entityType && h.entityId === entityId);
    }
    getAllChangeHistory() {
        return [...this.changeHistories];
    }
    clearAll() {
        this.trackAliases.clear();
        this.trackRemarks.clear();
        this.checkinPhotos.clear();
        this.rehearsalChanges.clear();
        this.approvalRecords.clear();
        this.changeHistories = [];
        this.importBatches.clear();
    }
}
exports.DataStore = DataStore;
//# sourceMappingURL=DataStore.js.map