"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataStore = void 0;
class DataStore {
    constructor() {
        this.registrations = new Map();
        this.waitlist = new Map();
        this.checkIns = new Map();
        this.blacklist = new Map();
        this.reconciliationBatches = new Map();
        this.reconciliationRecords = new Map();
    }
    static getInstance() {
        if (!DataStore.instance) {
            DataStore.instance = new DataStore();
        }
        return DataStore.instance;
    }
    saveRegistrations(records) {
        records.forEach((r) => this.registrations.set(r.id, r));
    }
    getRegistration(id) {
        return this.registrations.get(id);
    }
    getAllRegistrations() {
        return Array.from(this.registrations.values());
    }
    saveWaitlist(records) {
        records.forEach((r) => this.waitlist.set(r.id, r));
    }
    getWaitlistRecord(id) {
        return this.waitlist.get(id);
    }
    getAllWaitlist() {
        return Array.from(this.waitlist.values());
    }
    saveCheckIns(records) {
        records.forEach((r) => this.checkIns.set(r.id, r));
    }
    getCheckIn(id) {
        return this.checkIns.get(id);
    }
    getAllCheckIns() {
        return Array.from(this.checkIns.values());
    }
    saveBlacklist(records) {
        records.forEach((r) => this.blacklist.set(r.id, r));
    }
    getBlacklistRecord(id) {
        return this.blacklist.get(id);
    }
    getAllBlacklist() {
        return Array.from(this.blacklist.values());
    }
    saveReconciliationBatch(batch) {
        this.reconciliationBatches.set(batch.id, batch);
    }
    getReconciliationBatch(id) {
        return this.reconciliationBatches.get(id);
    }
    getAllReconciliationBatches() {
        return Array.from(this.reconciliationBatches.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    saveReconciliationRecords(records) {
        records.forEach((r) => this.reconciliationRecords.set(r.id, r));
    }
    updateReconciliationRecord(record) {
        this.reconciliationRecords.set(record.id, record);
    }
    getReconciliationRecord(id) {
        return this.reconciliationRecords.get(id);
    }
    getReconciliationRecordsByBatch(batchId) {
        return Array.from(this.reconciliationRecords.values())
            .filter((r) => r.reconciliationBatchId === batchId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    getAllReconciliationRecords() {
        return Array.from(this.reconciliationRecords.values());
    }
    clearAll() {
        this.registrations.clear();
        this.waitlist.clear();
        this.checkIns.clear();
        this.blacklist.clear();
        this.reconciliationBatches.clear();
        this.reconciliationRecords.clear();
    }
    clearImportedData() {
        this.registrations.clear();
        this.waitlist.clear();
        this.checkIns.clear();
        this.blacklist.clear();
    }
}
exports.DataStore = DataStore;
