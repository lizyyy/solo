"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWorkflow = resetWorkflow;
exports.getCurrentStep = getCurrentStep;
exports.advanceStep = advanceStep;
exports.runFirstImport = runFirstImport;
exports.runTemperatureCalibrationReview = runTemperatureCalibrationReview;
exports.runUnitConversionUpdate = runUnitConversionUpdate;
exports.getWorkflowResult = getWorkflowResult;
const importer_js_1 = require("../core/importer.js");
const result_store_js_1 = require("../core/result-store.js");
const evidence_trail_js_1 = require("../core/evidence-trail.js");
const VALID_STEPS = [
    "first_import",
    "temperature_calibration_review",
    "unit_conversion_update",
];
let currentStepIndex = 0;
function resetWorkflow() {
    currentStepIndex = 0;
    (0, importer_js_1.resetImporter)();
}
function getCurrentStep() {
    return VALID_STEPS[currentStepIndex];
}
function advanceStep() {
    if (currentStepIndex < VALID_STEPS.length - 1) {
        currentStepIndex++;
        return VALID_STEPS[currentStepIndex];
    }
    return null;
}
function runFirstImport(rawData, config) {
    if (currentStepIndex !== 0) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, cannot re-run first import`);
    }
    const result = (0, importer_js_1.firstImport)(rawData, config);
    (0, result_store_js_1.setRecords)(result.records);
    return result;
}
function runTemperatureCalibrationReview(supplements, config) {
    if (currentStepIndex !== 1) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, please complete previous step first`);
    }
    const result = (0, importer_js_1.supplementTemperatureCalibration)(supplements, config);
    (0, result_store_js_1.setRecords)(result.records);
    const records = (0, result_store_js_1.getRecords)();
    const patched = records.map((r) => {
        if (r.avgMasked && r.isOverThreshold) {
            return (0, evidence_trail_js_1.updateProcessingStatus)(r, "pending_review", "after temp calibration review, avg-masked over-threshold record restored to pending_review for maintenance worker confirmation");
        }
        return (0, evidence_trail_js_1.attachSamplingNote)(r, "temp calibration reviewed", null);
    });
    (0, result_store_js_1.setRecords)(patched);
    return (0, result_store_js_1.getResult)();
}
function runUnitConversionUpdate(conversionMap, config) {
    if (currentStepIndex !== 2) {
        throw new Error(`Current step is ${VALID_STEPS[currentStepIndex]}, please complete previous step first`);
    }
    const result = (0, importer_js_1.updateUnitConversion)(conversionMap, config);
    (0, result_store_js_1.setRecords)(result.records);
    const records = (0, result_store_js_1.getRecords)();
    const patched = records.map((r) => {
        if (r.avgMasked && r.isOverThreshold) {
            return (0, evidence_trail_js_1.updateProcessingStatus)(r, "pending_review", "after unit conversion update, avg-masked over-threshold record restored to pending_review for maintenance worker confirmation");
        }
        return (0, evidence_trail_js_1.attachSamplingNote)(r, "unit conversion updated", null);
    });
    (0, result_store_js_1.setRecords)(patched);
    return (0, result_store_js_1.getResult)();
}
function getWorkflowResult() {
    return (0, result_store_js_1.getResult)();
}
//# sourceMappingURL=index.js.map