"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const ConflictRecordService_1 = require("./ConflictRecordService");
const service = new ConflictRecordService_1.ConflictRecordService();
exports.api = {
    importRecords: (rows, importedBy, source) => {
        return service.importRecords(rows, importedBy, source);
    },
    rollbackImportBatch: (batchId, rolledBackBy, reason) => {
        return service.rollbackImportBatch(batchId, rolledBackBy, reason);
    },
    getImportBatches: () => {
        return service.getImportBatches();
    },
    getImportBatch: (batchId) => {
        return service.getImportBatch(batchId);
    },
    getRecords: (includeRolledBack = false) => {
        return service.getAllUnifiedRecords(includeRolledBack);
    },
    getRecord: (recordId) => {
        return service.getUnifiedRecordData(recordId);
    },
    getRecordForPage: (recordId) => {
        return service.getUnifiedRecordData(recordId);
    },
    getRecordsForExport: (includeRolledBack = false) => {
        return service.exportRecords(includeRolledBack);
    },
    getRecordsForApi: (includeRolledBack = false) => {
        return service.getAllUnifiedRecords(includeRolledBack);
    },
    addEngineerMessage: (recordId, message, addedBy) => {
        return service.addEngineerMessage(recordId, message, addedBy);
    },
    updateRecordStatus: (recordId, newStatus, updatedBy, reason) => {
        return service.updateStatus(recordId, newStatus, updatedBy, reason);
    },
    getRecordChangeHistory: (recordId) => {
        return service.getRecordChangeHistory(recordId);
    },
    createWeeklyReport: (createdBy) => {
        return service.createWeeklyReport(createdBy);
    },
    getWeeklyReportVersions: () => {
        return service.getWeeklyReportVersions();
    },
    getCurrentWeeklyReport: () => {
        return service.getCurrentWeeklyReport();
    },
    rollbackToPreviousReport: () => {
        return service.rollbackToPreviousReport();
    },
    rollbackRecordStatus: (recordId, rolledBackBy, reason) => {
        return service.rollbackRecordStatus(recordId, rolledBackBy, reason);
    },
    _getService: () => {
        return service;
    },
};
