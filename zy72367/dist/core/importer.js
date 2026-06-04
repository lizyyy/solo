import { processRecords, recalculateAfterSupplement } from "./processor.js";
let existingRecords = [];
let batchCounter = 0;
export function resetImporter() {
    existingRecords = [];
    batchCounter = 0;
}
export function firstImport(rawData, config) {
    const batchId = `batch_${++batchCounter}`;
    const seen = new Set();
    const records = [];
    let duplicateSkipped = 0;
    for (const raw of rawData) {
        const key = `${raw.beltId}_${raw.timestamp}_${raw.tensionValue}`;
        if (seen.has(key)) {
            duplicateSkipped++;
            continue;
        }
        seen.add(key);
        const record = {
            id: `${batchId}_${raw.originalLineNumber}`,
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
        };
        records.push(record);
    }
    const processed = processRecords(records, config);
    existingRecords = processed;
    return {
        batchId,
        step: "first_import",
        importedCount: processed.length,
        duplicateSkipped,
        overThresholdCount: processed.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: processed.filter((r) => r.avgMasked).length,
        records: processed,
    };
}
export function supplementTemperatureCalibration(supplements, config) {
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
    const recalculated = recalculateAfterSupplement(existingRecords, [], config);
    existingRecords = recalculated;
    return {
        batchId,
        step: "temperature_calibration_review",
        importedCount: matched,
        duplicateSkipped: 0,
        overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
        records: recalculated,
    };
}
export function updateUnitConversion(conversionMap, config) {
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
    const recalculated = processRecords(updated, config);
    existingRecords = recalculated;
    return {
        batchId,
        step: "unit_conversion_update",
        importedCount: updated.length,
        duplicateSkipped: 0,
        overThresholdCount: recalculated.filter((r) => r.isOverThreshold).length,
        avgMaskedCount: recalculated.filter((r) => r.avgMasked).length,
        records: recalculated,
    };
}
export function getExistingRecords() {
    return [...existingRecords];
}
//# sourceMappingURL=importer.js.map