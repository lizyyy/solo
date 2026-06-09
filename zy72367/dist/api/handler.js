"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiGetRecords = apiGetRecords;
exports.apiGetSummary = apiGetSummary;
exports.apiGetResult = apiGetResult;
exports.apiGetExportData = apiGetExportData;
const result_store_js_1 = require("../core/result-store.js");
function apiGetRecords() {
    return (0, result_store_js_1.getRecords)();
}
function apiGetSummary() {
    return (0, result_store_js_1.getSummary)();
}
function apiGetResult() {
    return (0, result_store_js_1.getResult)();
}
function apiGetExportData() {
    const result = (0, result_store_js_1.getResult)();
    return {
        generatedAt: result.generatedAt,
        summary: result.summary,
        records: result.records.map((r) => ({
            originalLineNumber: r.originalLineNumber,
            timestamp: r.timestamp,
            beltId: r.beltId,
            tensionValue: r.tensionValue,
            unit: r.unit,
            temperature: r.temperature,
            temperatureCalibrationNote: r.temperatureCalibrationNote ?? "",
            isOverThreshold: r.isOverThreshold,
            thresholdValue: r.thresholdValue,
            processingStatus: r.processingStatus,
            avgMasked: r.avgMasked,
            samplingIntervalNote: r.samplingIntervalNote
                ? {
                    originalLineNumber: r.samplingIntervalNote.originalLineNumber,
                    note: r.samplingIntervalNote.note,
                    manualChange: r.samplingIntervalNote.manualChange ?? "",
                    currentStatus: r.samplingIntervalNote.currentStatus,
                    updatedAt: r.samplingIntervalNote.updatedAt,
                }
                : null,
            manualOverrides: r.manualOverrides.map((o) => ({
                operator: o.operator,
                previousValue: o.previousValue,
                newValue: o.newValue,
                reason: o.reason,
                timestamp: o.timestamp,
            })),
            importBatchId: r.importBatchId,
            importStep: r.importStep,
        })),
    };
}
//# sourceMappingURL=handler.js.map