"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
const uuid_1 = require("uuid");
class DataStore {
    candidates = new Map();
    importRecords = new Map();
    mergeHistories = new Map();
    addCandidate(candidate) {
        const now = new Date();
        const newCandidate = {
            ...candidate,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        this.candidates.set(newCandidate.id, newCandidate);
        return newCandidate;
    }
    getCandidate(id) {
        return this.candidates.get(id);
    }
    updateCandidate(id, updates) {
        const candidate = this.candidates.get(id);
        if (!candidate)
            return undefined;
        const updated = {
            ...candidate,
            ...updates,
            updatedAt: new Date()
        };
        this.candidates.set(id, updated);
        return updated;
    }
    deleteCandidate(id) {
        return this.candidates.delete(id);
    }
    findByPhoneOrEmail(phone, email) {
        const results = [];
        for (const candidate of this.candidates.values()) {
            if (candidate.phone === phone || candidate.email === email) {
                results.push(candidate);
            }
        }
        return results;
    }
    getAllCandidates() {
        return Array.from(this.candidates.values());
    }
    addImportRecord(record) {
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: new Date()
        };
        this.importRecords.set(newRecord.id, newRecord);
        return newRecord;
    }
    getImportRecord(id) {
        return this.importRecords.get(id);
    }
    updateImportRecord(id, updates) {
        const record = this.importRecords.get(id);
        if (!record)
            return undefined;
        const updated = {
            ...record,
            ...updates
        };
        this.importRecords.set(id, updated);
        return updated;
    }
    getAllImportRecords() {
        return Array.from(this.importRecords.values());
    }
    addMergeHistory(history) {
        const newHistory = {
            ...history,
            id: (0, uuid_1.v4)(),
            createdAt: new Date()
        };
        this.mergeHistories.set(newHistory.id, newHistory);
        return newHistory;
    }
    getMergeHistoriesByCandidate(candidateId) {
        const results = [];
        for (const history of this.mergeHistories.values()) {
            if (history.candidateId === candidateId || history.targetCandidateId === candidateId) {
                results.push(history);
            }
        }
        return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    getAllMergeHistories() {
        return Array.from(this.mergeHistories.values())
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    clearAll() {
        this.candidates.clear();
        this.importRecords.clear();
        this.mergeHistories.clear();
    }
}
exports.store = new DataStore();
