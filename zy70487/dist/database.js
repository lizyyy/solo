"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const lowdb_1 = require("lowdb");
const node_1 = require("lowdb/node");
const path_1 = require("path");
const defaultData = {
    tempTickets: [],
    messageRecords: [],
    batches: [],
    reviewRecords: []
};
const dbPath = (0, path_1.join)(process.cwd(), 'data', 'db.json');
class Database {
    constructor() {
        const adapter = new node_1.JSONFile(dbPath);
        this.db = new lowdb_1.Low(adapter, defaultData);
    }
    async init() {
        await this.db.read();
        if (!this.db.data) {
            this.db.data = defaultData;
        }
        await this.db.write();
    }
    get data() {
        return this.db.data;
    }
    async write() {
        await this.db.write();
    }
    async saveTempTicket(ticket) {
        this.data.tempTickets.push(ticket);
        await this.write();
        return ticket;
    }
    async findTempTicketById(id) {
        return this.data.tempTickets.find(t => t.id === id);
    }
    async findTempTicketByNo(ticketNo) {
        return this.data.tempTickets.find(t => t.ticketNo === ticketNo);
    }
    async saveBatch(batch) {
        this.data.batches.push(batch);
        await this.write();
        return batch;
    }
    async updateBatch(batchId, updates) {
        const index = this.data.batches.findIndex(b => b.id === batchId);
        if (index !== -1) {
            this.data.batches[index] = { ...this.data.batches[index], ...updates };
            await this.write();
        }
    }
    async findBatchById(id) {
        return this.data.batches.find(b => b.id === id);
    }
    async findAllBatches() {
        return [...this.data.batches];
    }
    async saveMessageRecord(record) {
        this.data.messageRecords.push(record);
        await this.write();
        return record;
    }
    async saveMessageRecords(records) {
        this.data.messageRecords.push(...records);
        await this.write();
        return records;
    }
    async updateMessageRecord(id, updates) {
        const index = this.data.messageRecords.findIndex(r => r.id === id);
        if (index !== -1) {
            this.data.messageRecords[index] = { ...this.data.messageRecords[index], ...updates };
            await this.write();
        }
    }
    async findMessageRecordsByBatch(batchId) {
        return this.data.messageRecords.filter(r => r.batchId === batchId);
    }
    async findMessageRecordById(id) {
        return this.data.messageRecords.find(r => r.id === id);
    }
    async findAllMessageRecords() {
        return [...this.data.messageRecords];
    }
    async saveReviewRecord(record) {
        this.data.reviewRecords.push(record);
        await this.write();
        return record;
    }
    async findReviewRecordsByMessage(messageId) {
        return this.data.reviewRecords.filter(r => r.messageId === messageId);
    }
}
exports.db = new Database();
