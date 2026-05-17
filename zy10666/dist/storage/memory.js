"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStorage = void 0;
const uuid_1 = require("uuid");
class MemoryStorage {
    constructor() {
        this.records = new Map();
        this.histories = new Map();
        this.badRows = [];
    }
    async createRecord(record) {
        const now = new Date().toISOString();
        const newRecord = {
            ...record,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now
        };
        this.records.set(newRecord.id, newRecord);
        return newRecord;
    }
    async getRecordById(id) {
        return this.records.get(id) || null;
    }
    async updateRecord(id, updates) {
        const record = this.records.get(id);
        if (!record)
            return null;
        const updatedRecord = {
            ...record,
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.records.set(id, updatedRecord);
        return updatedRecord;
    }
    async listRecords(params) {
        const { page = 1, pageSize = 20, status, sourceSystem, userId, videoId, keyword } = params;
        let filteredList = Array.from(this.records.values());
        if (status) {
            filteredList = filteredList.filter(r => r.status === status);
        }
        if (sourceSystem) {
            filteredList = filteredList.filter(r => r.sourceSystem === sourceSystem);
        }
        if (userId) {
            filteredList = filteredList.filter(r => r.user.userId === userId);
        }
        if (videoId) {
            filteredList = filteredList.filter(r => r.video.videoId === videoId);
        }
        if (keyword) {
            const lowerKeyword = keyword.toLowerCase();
            filteredList = filteredList.filter(r => r.video.videoTitle.toLowerCase().includes(lowerKeyword) ||
                r.user.userName.toLowerCase().includes(lowerKeyword) ||
                r.readableReason.toLowerCase().includes(lowerKeyword));
        }
        filteredList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const total = filteredList.length;
        const start = (page - 1) * pageSize;
        const list = filteredList.slice(start, start + pageSize);
        return { list, total, page, pageSize };
    }
    async findConflicts(userId, videoId) {
        return Array.from(this.records.values()).filter(r => r.user.userId === userId && r.video.videoId === videoId);
    }
    async addHistory(history) {
        const newHistory = {
            ...history,
            id: (0, uuid_1.v4)(),
            createdAt: new Date().toISOString()
        };
        const histories = this.histories.get(history.recordId) || [];
        histories.push(newHistory);
        this.histories.set(history.recordId, histories);
        return newHistory;
    }
    async getHistoriesByRecordId(recordId) {
        return this.histories.get(recordId) || [];
    }
    async addBadRow(badRow) {
        const newBadRow = {
            ...badRow,
            id: (0, uuid_1.v4)()
        };
        this.badRows.push(newBadRow);
        return newBadRow;
    }
    async getBadRows(batchId) {
        if (batchId) {
            return this.badRows.filter(row => row.batchId === batchId);
        }
        return this.badRows;
    }
    async getAllRecords() {
        return Array.from(this.records.values());
    }
    async getRecordsByStatus(status) {
        return Array.from(this.records.values()).filter(r => r.status === status);
    }
}
exports.memoryStorage = new MemoryStorage();
