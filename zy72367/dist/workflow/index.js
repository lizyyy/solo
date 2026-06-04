import { firstImport, supplementTemperatureCalibration, updateUnitConversion, resetImporter, } from "../core/importer.js";
import { setRecords, getRecords, getResult } from "../core/result-store.js";
import { attachSamplingNote, updateProcessingStatus } from "../core/evidence-trail.js";
const VALID_STEPS = [
    "first_import",
    "temperature_calibration_review",
    "unit_conversion_update",
];
let currentStepIndex = 0;
export function resetWorkflow() {
    currentStepIndex = 0;
    resetImporter();
}
export function getCurrentStep() {
    return VALID_STEPS[currentStepIndex];
}
export function advanceStep() {
    if (currentStepIndex < VALID_STEPS.length - 1) {
        currentStepIndex++;
        return VALID_STEPS[currentStepIndex];
    }
    return null;
}
export function runFirstImport(rawData, config) {
    if (currentStepIndex !== 0) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, cannot re-run first import`);
    }
    const result = firstImport(rawData, config);
    setRecords(result.records);
    return result;
}
export function runTemperatureCalibrationReview(supplements, config) {
    if (currentStepIndex !== 1) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, please complete previous step first`);
    }
    const result = supplementTemperatureCalibration(supplements, config);
    setRecords(result.records);
    const records = getRecords();
    const patched = records.map((r) => {
        if (r.avgMasked && r.isOverThreshold) {
            return updateProcessingStatus(r, "pending_review", "after temp calibration review, avg-masked over-threshold record restored to pending_review for maintenance worker confirmation");
        }
        return attachSamplingNote(r, "temp calibration reviewed", null);
    });
    setRecords(patched);
    return getResult();
}
export function runUnitConversionUpdate(conversionMap, config) {
    if (currentStepIndex !== 2) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, please complete previous step first`);
    }
    const result = updateUnitConversion(conversionMap, config);
    setRecords(result.records);
    const records = getRecords();
    const patched = records.map((r) => {
        if (r.avgMasked && r.isOverThreshold) {
            return updateProcessingStatus(r, "pending_review", "after unit conversion update, avg-masked over-threshold record restored to pending_review for maintenance worker confirmation");
        }
        return attachSamplingNote(r, "unit conversion updated", null);
    });
    setRecords(patched);
    return getResult();
}
export function getWorkflowResult() {
    return getResult();
}
//# sourceMappingURL=index.js.map