"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetImporter = resetImporter;
exports.firstImport = firstImport;
exports.supplementTemperatureCalibration = supplementTemperatureCalibration;
exports.updateUnitConversion = updateUnitConversion;
exports.getExistingRecords = getExistingRecords;
const processor_js_1 = require("./processor.js");
let existingRecords = [];
let batchCounter = 0;
function resetImporter() {
    existingRecords = [];
    batchCounter = 0;
}
function firstImport(rawData, config) {
    const batchId = `batch_${++batchCounter}`;
    const seenInBatch = new Map();
    const newRecordIds = [];
    const currentBatchDuplicateKeys = [];
    const historyDuplicateKeys = [];
    const historyKeyMap = new Map();
    for (const rec of existingRecords) {
        const key = `${rec.beltId}_${rec.timestamp}_${rec.tensionValue}`;
        historyKeyMap.set(key, rec.id);
    }
    const records = [];
    let duplicateSkipped = 0;
    for (const raw of rawData) {
        const key = `${raw.beltId}_${raw.timestamp}_${raw.tensionValue}`;
        let dedupCategory;
        let skipRecord = false;
        const historyExistingId = historyKeyMap.get(key);
        if (historyExistingId) {
            dedupCategory = "dup_history";
            historyDuplicateKeys.push({ key, line: raw.originalLineNumber, existingId: historyExistingId });
            duplicateSkipped++;
            skipRecord = true;
        }
        else if (seenInBatch.has(key)) {
            dedupCategory = "dup_in_batch";
            const firstOccurrence = seenInBatch.get(key);
            currentBatchDuplicateKeys.push({ key, line: raw.originalLineNumber });
            duplicateSkipped++;
            skipRecord = true;
        }
        else {
            dedupCategory = "new";
            const recordId = `${batchId}_${raw.originalLineNumber}`;
            seenInBatch.set(key, { line: raw.originalLineNumber, firstId: recordId });
            const record = {
                id: recordId,
                originalLineNumber: raw.originalLineNumber,
                timestamp: raw.timestamp,
                beltId: raw.beltId,
                tensionValue: raw.tensionValue,
                unit: raw.unit,
                temperature: raw.temperature,
                temperatureCalibrationNote: null,
                samplingIntervalNote: null,
                isOverThreshold: false,
                thresholdValue: config.upperLimit,
                processingStatus: "pending_review",
                avgMasked: false,
                manualOverrides: [],
                importBatchId: batchId,
                importStep: "first_import",
                dedupCategory,
            };
            records.push(record);
            newRecordIds.push(recordId);
        }
    }
    const processed = (0, processor_js_1.processRecords)(records, config);
    existingRecords = processed;
    return {
        batchId,
        step: "first_import",
        importedCount: processed.length,
        duplicateSkipped,
        overThresholdCount: processed.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: processed.filter((r) => r.avgMasked).length,
        records: processed,
        newRecordIds,
        currentBatchDuplicateKeys,
        historyDuplicateKeys,
    };
}
function supplementTemperatureCalibration(supplements, config) {
    const batchId = `batch_${++batchCounter}`;
    let matched = 0;
    for (const sup of supplements) {
        const record = existingRecords.find((r) => r.beltId === sup.beltId && r.timestamp === sup.timestamp);
        if (record) {
            record.temperatureCalibrationNote = sup.calibrationNote;
            record.temperature = sup.temperature;
            matched++;
        }
    }
    const recalculated = (0, processor_js_1.recalculateAfterSupplement)(existingRecords, [], config);
    existingRecords = recalculated;
    return {
        batchId,
        step: "temperature_calibration_review",
        importedCount: matched,
        duplicateSkipped: 0,
        overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
        records: recalculated,
        newRecordIds: [],
        currentBatchDuplicateKeys: [],
        historyDuplicateKeys: [],
    };
}
function updateUnitConversion(conversionMap, config) {
    const batchId = `batch_${++batchCounter}`;
    const updated = existingRecords.map((record) => {
        const conv = conversionMap.find((c) => c.beltId === record.beltId && c.fromUnit === record.unit);
        if (!conv)
            return record;
        const newValue = record.tensionValue * conv.factor;
        const override = {
            operator: "unit_conversion",
            previousValue: record.tensionValue,
            newValue,
            reason: `${conv.fromUnit} -> ${conv.toUnit}, factor ${conv.factor}`,
            timestamp: new Date().toISOString(),
        };
        return {
            ...record,
            tensionValue: newValue,
            unit: conv.toUnit,
            manualOverrides: [...record.manualOverrides, override],
        };
    });
    const recalculated = (0, processor_js_1.processRecords)(updated, config);
    existingRecords = recalculated;
    return {
        batchId,
        step: "unit_conversion_update",
        importedCount: updated.length,
        duplicateSkipped: 0,
        overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
        records: recalculated,
        newRecordIds: [],
        currentBatchDuplicateKeys: [],
        historyDuplicateKeys: [],
    };
}
function getExistingRecords() {
    return [...existingRecords];
}
//# sourceMappingURL=importer.js.map