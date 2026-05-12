"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
exports.getAuditHistory = getAuditHistory;
exports.getAllAuditRecords = getAllAuditRecords;
exports.computeDiff = computeDiff;
const uuid_1 = require("uuid");
const dataStore_1 = require("../store/dataStore");
function recordAudit(targetType, targetId, action, operatorId, operatorName, options = {}) {
    const store = (0, dataStore_1.loadStore)();
    const record = {
        id: (0, uuid_1.v4)(),
        targetType,
        targetId,
        action,
        operatorId,
        operatorName,
        beforeState: options.beforeState,
        afterState: options.afterState,
        diff: options.diff,
        reason: options.reason,
        timestamp: new Date().toISOString()
    };
    store.auditRecords.push(record);
    (0, dataStore_1.saveStore)(store);
    return record;
}
function getAuditHistory(targetType, targetId) {
    const store = (0, dataStore_1.loadStore)();
    return store.auditRecords
        .filter(r => r.targetType === targetType && r.targetId === targetId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}
function getAllAuditRecords() {
    const store = (0, dataStore_1.loadStore)();
    return [...store.auditRecords].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
function computeDiff(before, after, keysToCompare) {
    const diffs = [];
    for (const key of keysToCompare) {
        const beforeVal = before[key];
        const afterVal = after[key];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            diffs.push({
                field: String(key),
                before: beforeVal,
                after: afterVal
            });
        }
    }
    return diffs;
}
