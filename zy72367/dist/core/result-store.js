"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRecords = setRecords;
exports.getRecords = getRecords;
exports.getResult = getResult;
exports.getSummary = getSummary;
exports.resetStore = resetStore;
let records = [];
let lastGeneratedAt = "";
function setRecords(newRecords) {
    records = newRecords;
    lastGeneratedAt = new Date().toISOString();
}
function getRecords() {
    return [...records];
}
function getResult() {
    const summary = buildSummary(records);
    return {
        records: [...records],
        summary,
        generatedAt: lastGeneratedAt,
    };
}
function getSummary() {
    return buildSummary(records);
}
function buildSummary(recs) {
    return {
        totalRecords: recs.length,
        overThresholdCount: recs.filter((r) => r.isOverThreshold).length,
        avgMaskedButOverThresholdCount: recs.filter((r) => r.avgMasked && r.isOverThreshold).length,
        pendingReviewCount: recs.filter((r) => r.processingStatus === "pending_review")
            .length,
        confirmedNormalCount: recs.filter((r) => r.processingStatus === "confirmed_normal").length,
        confirmedAbnormalCount: recs.filter((r) => r.processingStatus === "confirmed_abnormal").length,
    };
}
function resetStore() {
    records = [];
    lastGeneratedAt = "";
}
//# sourceMappingURL=result-store.js.map