"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkThreshold = checkThreshold;
exports.processRecords = processRecords;
exports.recalculateAfterSupplement = recalculateAfterSupplement;
function checkThreshold(value, config) {
    return value > config.upperLimit || value < config.lowerLimit;
}
function processRecords(rawRecords, config) {
    const avg = computeAverage(rawRecords);
    return rawRecords.map((record) => {
        const isOver = checkThreshold(record.tensionValue, config);
        const nearAvg = Math.abs(record.tensionValue - avg) < avg * 0.05;
        const avgMasked = isOver && nearAvg;
        let status = "pending_review";
        if (avgMasked) {
            status = "overridden_by_average";
        }
        return {
            ...record,
            isOverThreshold: isOver,
            thresholdValue: config.upperLimit,
            avgMasked,
            processingStatus: status,
        };
    });
}
function computeAverage(records) {
    if (records.length === 0)
        return 0;
    const sum = records.reduce((acc, r) => acc + r.tensionValue, 0);
    return sum / records.length;
}
function recalculateAfterSupplement(existingRecords, supplementRecords, config) {
    const merged = [...existingRecords, ...supplementRecords];
    const avg = computeAverage(merged);
    return merged.map((record) => {
        const isOver = checkThreshold(record.tensionValue, config);
        const nearAvg = Math.abs(record.tensionValue - avg) < avg * 0.05;
        const avgMasked = isOver && nearAvg;
        const prevMasked = record.avgMasked;
        const statusChanged = prevMasked !== avgMasked;
        let status = record.processingStatus;
        if (isOver && avgMasked) {
            status = "overridden_by_average";
        }
        else if (isOver && !avgMasked) {
            status = statusChanged ? "pending_review" : record.processingStatus;
        }
        return {
            ...record,
            isOverThreshold: isOver,
            avgMasked,
            processingStatus: status,
        };
    });
}
//# sourceMappingURL=processor.js.map