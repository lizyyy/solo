"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.elders = new Map();
        this.schedules = new Map();
        this.serviceOrders = new Map();
        this.reconciliationRecords = new Map();
        this.reconciliationBatches = new Map();
    }
    static getInstance() {
        if (!DataStore.instance) {
            DataStore.instance = new DataStore();
        }
        return DataStore.instance;
    }
    clearAll() {
        this.elders.clear();
        this.schedules.clear();
        this.serviceOrders.clear();
        this.reconciliationRecords.clear();
        this.reconciliationBatches.clear();
    }
    saveElder(elder) {
        this.elders.set(elder.id, elder);
    }
    saveElders(elders) {
        elders.forEach(e => this.saveElder(e));
    }
    getElder(id) {
        return this.elders.get(id);
    }
    getAllElders() {
        return Array.from(this.elders.values());
    }
    saveSchedule(nurseId, schedule) {
        const existing = this.schedules.get(nurseId) || [];
        const filtered = existing.filter(s => s.date !== schedule.date);
        this.schedules.set(nurseId, [...filtered, schedule]);
    }
    saveSchedules(schedules) {
        schedules.forEach(s => this.saveSchedule(s.nurseId, s));
    }
    getSchedulesByNurse(nurseId) {
        return this.schedules.get(nurseId) || [];
    }
    getAllSchedules() {
        return Array.from(this.schedules.values()).flat();
    }
    getSchedulesByDate(date) {
        return this.getAllSchedules().filter(s => s.date === date);
    }
    saveServiceOrder(order) {
        this.serviceOrders.set(order.id, order);
    }
    saveServiceOrders(orders) {
        orders.forEach(o => this.saveServiceOrder(o));
    }
    getServiceOrder(id) {
        return this.serviceOrders.get(id);
    }
    getServiceOrdersByDateRange(start, end) {
        return Array.from(this.serviceOrders.values()).filter(o => o.serviceDate >= start && o.serviceDate <= end);
    }
    getAllServiceOrders() {
        return Array.from(this.serviceOrders.values());
    }
    createBatch(name, periodStart, periodEnd, createdBy) {
        const batch = {
            id: (0, uuid_1.v4)(),
            name,
            periodStart,
            periodEnd,
            totalRecords: 0,
            matchedCount: 0,
            discrepancyCount: 0,
            reviewingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            supplementCount: 0,
            status: 'processing',
            createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.reconciliationBatches.set(batch.id, batch);
        return batch;
    }
    saveBatch(batch) {
        batch.updatedAt = new Date();
        this.reconciliationBatches.set(batch.id, batch);
    }
    getBatch(id) {
        return this.reconciliationBatches.get(id);
    }
    getAllBatches() {
        return Array.from(this.reconciliationBatches.values());
    }
    saveReconciliationRecord(record) {
        record.updatedAt = new Date();
        this.reconciliationRecords.set(record.id, record);
    }
    saveReconciliationRecords(records) {
        records.forEach(r => this.saveReconciliationRecord(r));
    }
    getReconciliationRecord(id) {
        return this.reconciliationRecords.get(id);
    }
    getRecordsByBatch(batchId) {
        return Array.from(this.reconciliationRecords.values()).filter(r => r.batchId === batchId);
    }
    updateBatchStats(batchId) {
        const records = this.getRecordsByBatch(batchId);
        const batch = this.getBatch(batchId);
        if (!batch)
            return;
        batch.totalRecords = records.length;
        batch.matchedCount = records.filter(r => r.status === 'matched').length;
        batch.discrepancyCount = records.filter(r => r.status === 'discrepancy').length;
        batch.reviewingCount = records.filter(r => r.status === 'reviewing').length;
        batch.approvedCount = records.filter(r => r.status === 'approved').length;
        batch.rejectedCount = records.filter(r => r.status === 'rejected').length;
        batch.supplementCount = records.filter(r => r.status === 'supplement').length;
        this.saveBatch(batch);
    }
}
exports.default = DataStore.getInstance();
