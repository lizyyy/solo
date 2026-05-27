"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.rentalOrders = new Map();
        this.repairRecords = new Map();
        this.depositRules = new Map();
        this.discrepancies = new Map();
        this.reviewRecords = new Map();
        this.reconciliationResults = new Map();
    }
    generateId() {
        return (0, uuid_1.v4)();
    }
    addRentalOrder(order) {
        const id = this.generateId();
        const newOrder = { ...order, id };
        this.rentalOrders.set(id, newOrder);
        return newOrder;
    }
    getRentalOrder(id) {
        return this.rentalOrders.get(id);
    }
    getRentalOrderByNo(orderNo) {
        return Array.from(this.rentalOrders.values()).find((o) => o.orderNo === orderNo);
    }
    getAllRentalOrders() {
        return Array.from(this.rentalOrders.values());
    }
    updateRentalOrder(id, updates) {
        const order = this.rentalOrders.get(id);
        if (!order)
            return undefined;
        const updated = { ...order, ...updates };
        this.rentalOrders.set(id, updated);
        return updated;
    }
    addRepairRecord(record) {
        const id = this.generateId();
        const newRecord = { ...record, id };
        this.repairRecords.set(id, newRecord);
        return newRecord;
    }
    getRepairRecord(id) {
        return this.repairRecords.get(id);
    }
    getRepairRecordsBySerialNo(serialNo) {
        return Array.from(this.repairRecords.values()).filter((r) => r.equipmentSerialNo === serialNo);
    }
    getRepairRecordsByOrderNo(orderNo) {
        return Array.from(this.repairRecords.values()).filter((r) => r.boundOrderNo === orderNo);
    }
    getAllRepairRecords() {
        return Array.from(this.repairRecords.values());
    }
    updateRepairRecord(id, updates) {
        const record = this.repairRecords.get(id);
        if (!record)
            return undefined;
        const updated = { ...record, ...updates };
        this.repairRecords.set(id, updated);
        return updated;
    }
    addDepositRule(rule) {
        const id = this.generateId();
        const newRule = { ...rule, id };
        this.depositRules.set(id, newRule);
        return newRule;
    }
    getDepositRule(id) {
        return this.depositRules.get(id);
    }
    getActiveDepositRules() {
        return Array.from(this.depositRules.values()).filter((r) => r.isActive);
    }
    getAllDepositRules() {
        return Array.from(this.depositRules.values());
    }
    updateDepositRule(id, updates) {
        const rule = this.depositRules.get(id);
        if (!rule)
            return undefined;
        const updated = { ...rule, ...updates };
        this.depositRules.set(id, updated);
        return updated;
    }
    addDiscrepancy(discrepancy) {
        const id = this.generateId();
        const newDiscrepancy = { ...discrepancy, id };
        this.discrepancies.set(id, newDiscrepancy);
        return newDiscrepancy;
    }
    getDiscrepanciesByOrderNo(orderNo) {
        return Array.from(this.discrepancies.values()).filter((d) => d.orderNo === orderNo);
    }
    updateDiscrepancy(id, updates) {
        const discrepancy = this.discrepancies.get(id);
        if (!discrepancy)
            return undefined;
        const updated = { ...discrepancy, ...updates };
        this.discrepancies.set(id, updated);
        return updated;
    }
    addReviewRecord(record) {
        const id = this.generateId();
        const newRecord = { ...record, id };
        this.reviewRecords.set(id, newRecord);
        return newRecord;
    }
    getReviewRecordsByOrderNo(orderNo) {
        return Array.from(this.reviewRecords.values())
            .filter((r) => r.orderNo === orderNo)
            .sort((a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime());
    }
    setReconciliationResult(result) {
        this.reconciliationResults.set(result.orderNo, result);
    }
    getReconciliationResult(orderNo) {
        return this.reconciliationResults.get(orderNo);
    }
    getAllReconciliationResults() {
        return Array.from(this.reconciliationResults.values());
    }
    clearAll() {
        this.rentalOrders.clear();
        this.repairRecords.clear();
        this.depositRules.clear();
        this.discrepancies.clear();
        this.reviewRecords.clear();
        this.reconciliationResults.clear();
    }
}
exports.dataStore = new DataStore();
