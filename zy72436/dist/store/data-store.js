"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.ticketRows = new Map();
        this.importBatches = new Map();
        this.fileHashSet = new Set();
        this.classificationResults = new Map();
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    addImportBatch(batch) {
        this.importBatches.set(batch.id, batch);
        this.fileHashSet.add(batch.fileHash);
    }
    getImportBatch(id) {
        return this.importBatches.get(id);
    }
    hasFileHash(hash) {
        return this.fileHashSet.has(hash);
    }
    getAllImportBatches() {
        return Array.from(this.importBatches.values());
    }
    addTicketRow(row) {
        this.ticketRows.set(row.id, row);
    }
    getTicketRow(id) {
        return this.ticketRows.get(id);
    }
    getAllTicketRows() {
        return Array.from(this.ticketRows.values());
    }
    getTicketRowsByBatch(batchId) {
        return Array.from(this.ticketRows.values()).filter(r => r.importBatchId === batchId);
    }
    getTicketRowsByTrack(trackId) {
        return Array.from(this.ticketRows.values()).filter(r => r.trackId === trackId);
    }
    updateTicketRow(id, updates) {
        const row = this.ticketRows.get(id);
        if (!row)
            return undefined;
        const updated = { ...row, ...updates, lastUpdatedAt: new Date().toISOString() };
        this.ticketRows.set(id, updated);
        return updated;
    }
    findDuplicateRow(studentName, instrument, trackId) {
        return Array.from(this.ticketRows.values()).find(r => r.studentName === studentName && r.instrument === instrument && r.trackId === trackId);
    }
    setClassificationResult(trackId, result) {
        this.classificationResults.set(trackId, result);
    }
    getClassificationResult(trackId) {
        return this.classificationResults.get(trackId);
    }
    getAllClassificationResults() {
        return Array.from(this.classificationResults.values());
    }
    clear() {
        this.ticketRows.clear();
        this.importBatches.clear();
        this.fileHashSet.clear();
        this.classificationResults.clear();
    }
}
exports.dataStore = new DataStore();
