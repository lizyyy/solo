"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataStore = void 0;
const uuid_1 = require("uuid");
class DataStore {
    constructor() {
        this.maintenanceRecords = new Map();
        this.sensorData = new Map();
        this.approvalRecords = new Map();
        this.reconciliationResults = new Map();
        this.reviewRecords = new Map();
        this.reports = new Map();
        this.batchImports = new Map();
    }
    addMaintenanceRecord(record) {
        const id = (0, uuid_1.v4)();
        const fullRecord = {
            ...record,
            id,
            source: 'csv',
            importedAt: new Date().toISOString(),
        };
        this.maintenanceRecords.set(id, fullRecord);
        return fullRecord;
    }
    addSensorData(data) {
        const id = (0, uuid_1.v4)();
        const fullData = {
            ...data,
            id,
            source: 'json',
            importedAt: new Date().toISOString(),
        };
        this.sensorData.set(id, fullData);
        return fullData;
    }
    addApprovalRecord(record) {
        const id = (0, uuid_1.v4)();
        const fullRecord = {
            ...record,
            id,
            importedAt: new Date().toISOString(),
        };
        this.approvalRecords.set(id, fullRecord);
        return fullRecord;
    }
    getMaintenanceRecord(id) {
        return this.maintenanceRecords.get(id);
    }
    getSensorData(id) {
        return this.sensorData.get(id);
    }
    getApprovalRecord(id) {
        return this.approvalRecords.get(id);
    }
    getAllMaintenanceRecords() {
        return Array.from(this.maintenanceRecords.values());
    }
    getAllSensorData() {
        return Array.from(this.sensorData.values());
    }
    getAllApprovalRecords() {
        return Array.from(this.approvalRecords.values());
    }
    getMaintenanceByCableCar(cableCarId) {
        return this.getAllMaintenanceRecords().filter(r => r.cableCarId === cableCarId);
    }
    getSensorByCableCar(cableCarId) {
        return this.getAllSensorData().filter(s => s.cableCarId === cableCarId);
    }
    getApprovalByCableCar(cableCarId) {
        return this.getAllApprovalRecords().filter(a => a.cableCarId === cableCarId);
    }
    addReconciliationResult(result) {
        const id = (0, uuid_1.v4)();
        const fullResult = {
            ...result,
            id,
            createdAt: new Date().toISOString(),
        };
        this.reconciliationResults.set(id, fullResult);
        return fullResult;
    }
    getReconciliationResult(id) {
        return this.reconciliationResults.get(id);
    }
    getAllReconciliationResults() {
        return Array.from(this.reconciliationResults.values());
    }
    updateReconciliationResult(id, updates) {
        const existing = this.reconciliationResults.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates };
        this.reconciliationResults.set(id, updated);
        return updated;
    }
    addReviewRecord(record) {
        const id = (0, uuid_1.v4)();
        const fullRecord = {
            ...record,
            id,
            reviewedAt: new Date().toISOString(),
        };
        this.reviewRecords.set(id, fullRecord);
        return fullRecord;
    }
    getReviewRecordsByDiff(diffId) {
        return Array.from(this.reviewRecords.values()).filter(r => r.diffId === diffId);
    }
    addReport(report) {
        const id = (0, uuid_1.v4)();
        const fullReport = {
            ...report,
            id,
            generatedAt: new Date().toISOString(),
        };
        this.reports.set(id, fullReport);
        return fullReport;
    }
    getReport(id) {
        return this.reports.get(id);
    }
    getAllReports() {
        return Array.from(this.reports.values());
    }
    addBatchImport(batch) {
        const batchId = (0, uuid_1.v4)();
        const fullBatch = {
            ...batch,
            batchId,
            importedAt: new Date().toISOString(),
        };
        this.batchImports.set(batchId, fullBatch);
        return fullBatch;
    }
    getBatchImport(batchId) {
        return this.batchImports.get(batchId);
    }
    clearAll() {
        this.maintenanceRecords.clear();
        this.sensorData.clear();
        this.approvalRecords.clear();
        this.reconciliationResults.clear();
        this.reviewRecords.clear();
        this.reports.clear();
        this.batchImports.clear();
    }
}
exports.dataStore = new DataStore();
//# sourceMappingURL=dataStore.js.map