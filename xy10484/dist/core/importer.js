"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importOrders = importOrders;
exports.importSignRecords = importSignRecords;
exports.importRefuseRecords = importRefuseRecords;
exports.importClaimRecords = importClaimRecords;
exports.runAnalysis = runAnalysis;
const store_1 = require("../utils/store");
const analyzer_1 = require("./analyzer");
function importOrders(orders) {
    const store = (0, store_1.loadStore)();
    const existingTrackingNos = new Set(store.orders.map((o) => o.trackingNo));
    const newOrders = orders.filter((o) => !existingTrackingNos.has(o.trackingNo));
    store.orders.push(...newOrders);
    (0, store_1.saveStore)(store);
    return newOrders.length;
}
function importSignRecords(records) {
    const store = (0, store_1.loadStore)();
    const duplicateBatches = [];
    const toImport = [];
    for (const record of records) {
        if (record.batchId && store.processedBatches.includes(record.batchId)) {
            if (!duplicateBatches.includes(record.batchId)) {
                duplicateBatches.push(record.batchId);
            }
        }
        else {
            toImport.push(record);
            if (record.batchId && !store.processedBatches.includes(record.batchId)) {
                store.processedBatches.push(record.batchId);
            }
        }
    }
    store.signRecords.push(...toImport);
    (0, store_1.saveStore)(store);
    return { imported: toImport.length, duplicateBatches };
}
function importRefuseRecords(records) {
    const store = (0, store_1.loadStore)();
    store.refuseRecords.push(...records);
    (0, store_1.saveStore)(store);
    return records.length;
}
function importClaimRecords(records) {
    const store = (0, store_1.loadStore)();
    const existingClaimIds = new Set(store.claimRecords.map((c) => c.claimId));
    const newClaims = records.filter((r) => !existingClaimIds.has(r.claimId));
    store.claimRecords.push(...newClaims);
    (0, store_1.saveStore)(store);
    return newClaims.length;
}
function runAnalysis() {
    const store = (0, store_1.loadStore)();
    const existingAbnormalIds = new Set(store.abnormals.map((a) => a.id));
    const existingIssueIds = new Set(store.issues.map((i) => i.id));
    const newAbnormals = (0, analyzer_1.analyzeAbnormals)(store).filter((a) => !existingAbnormalIds.has(a.id));
    const newIssues = (0, analyzer_1.analyzeIssues)(store).filter((i) => !existingIssueIds.has(i.id));
    store.abnormals.push(...newAbnormals);
    store.issues.push(...newIssues);
    (0, store_1.saveStore)(store);
    return { newAbnormals: newAbnormals.length, newIssues: newIssues.length };
}
