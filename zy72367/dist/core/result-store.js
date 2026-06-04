let records = [];
let lastGeneratedAt = "";
export function setRecords(newRecords) {
    records = newRecords;
    lastGeneratedAt = new Date().toISOString();
}
export function getRecords() {
    return [...records];
}
export function getResult() {
    const summary = buildSummary(records);
    return {
        records: [...records],
        summary,
        generatedAt: lastGeneratedAt,
    };
}
export function getSummary() {
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
export function resetStore() {
    records = [];
    lastGeneratedAt = "";
}
//# sourceMappingURL=result-store.js.map