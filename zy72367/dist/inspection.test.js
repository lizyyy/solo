"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_js_1 = require("./self-test/index.js");
const index_js_2 = require("./workflow/index.js");
const handler_js_1 = require("./api/handler.js");
const config = { upperLimit: 100, lowerLimit: 20, unit: "N" };
function makeSampleData(count, baseValue) {
    return Array.from({ length: count }, (_, i) => ({
        originalLineNumber: i + 1,
        timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T08:00:00Z`,
        beltId: `BELT-${String((i % 3) + 1).padStart(2, "0")}`,
        tensionValue: baseValue + (i % 5) * 2,
        unit: "N",
        temperature: 25 + (i % 3),
    }));
}
(0, vitest_1.describe)("self-test", () => {
    (0, vitest_1.it)("all self-tests pass", () => {
        const results = (0, index_js_1.runSelfTests)();
        for (const r of results) {
            (0, vitest_1.expect)(r.passed).toBe(true);
        }
    });
});
(0, vitest_1.describe)("three-step workflow", () => {
    (0, vitest_1.beforeEach)(() => {
        (0, index_js_2.resetWorkflow)();
    });
    (0, vitest_1.it)("step 1: first import", () => {
        const result = (0, index_js_2.runFirstImport)(makeSampleData(8, 50), config);
        (0, vitest_1.expect)(result.step).toBe("first_import");
        (0, vitest_1.expect)(result.importedCount).toBe(8);
    });
    (0, vitest_1.it)("step 2: temperature calibration review restores avg-masked to pending_review", () => {
        (0, index_js_2.runFirstImport)(makeSampleData(8, 50), config);
        (0, index_js_2.advanceStep)();
        const result = (0, index_js_2.runTemperatureCalibrationReview)([{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }], config);
        const maskedButOver = result.records.filter((r) => r.avgMasked && r.isOverThreshold);
        for (const r of maskedButOver) {
            (0, vitest_1.expect)(r.processingStatus).toBe("pending_review");
        }
    });
    (0, vitest_1.it)("step 3: unit conversion update keeps avg-masked over-threshold as pending_review", () => {
        (0, index_js_2.runFirstImport)(makeSampleData(8, 50), config);
        (0, index_js_2.advanceStep)();
        (0, index_js_2.runTemperatureCalibrationReview)([{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }], config);
        (0, index_js_2.advanceStep)();
        const result = (0, index_js_2.runUnitConversionUpdate)([{ beltId: "BELT-01", fromUnit: "N", toUnit: "kN", factor: 0.001 }], config);
        const maskedButOver = result.records.filter((r) => r.avgMasked && r.isOverThreshold);
        for (const r of maskedButOver) {
            (0, vitest_1.expect)(r.processingStatus).toBe("pending_review");
        }
    });
});
(0, vitest_1.describe)("single source of truth", () => {
    (0, vitest_1.beforeEach)(() => {
        (0, index_js_2.resetWorkflow)();
    });
    (0, vitest_1.it)("api and workflow return same records", () => {
        (0, index_js_2.runFirstImport)(makeSampleData(5, 50), config);
        (0, index_js_2.advanceStep)();
        (0, index_js_2.runTemperatureCalibrationReview)([{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }], config);
        const workflowResult = (0, index_js_2.getWorkflowResult)();
        const apiRecords = (0, handler_js_1.apiGetRecords)();
        const exportData = (0, handler_js_1.apiGetExportData)();
        (0, vitest_1.expect)(apiRecords.length).toBe(workflowResult.records.length);
        (0, vitest_1.expect)(exportData.records.length).toBe(workflowResult.records.length);
        for (let i = 0; i < apiRecords.length; i++) {
            (0, vitest_1.expect)(apiRecords[i].id).toBe(workflowResult.records[i].id);
            (0, vitest_1.expect)(exportData.records[i].beltId).toBe(workflowResult.records[i].beltId);
        }
    });
    (0, vitest_1.it)("over-threshold records never disappear in any view", () => {
        const data = [
            ...makeSampleData(8, 50),
            { originalLineNumber: 9, timestamp: "2024-01-09T08:00:00Z", beltId: "BELT-01", tensionValue: 105, unit: "N", temperature: 25 },
        ];
        (0, index_js_2.runFirstImport)(data, config);
        const workflowResult = (0, index_js_2.getWorkflowResult)();
        const apiRecords = (0, handler_js_1.apiGetRecords)();
        const exportData = (0, handler_js_1.apiGetExportData)();
        const wfOverCount = workflowResult.records.filter((r) => r.isOverThreshold).length;
        const apiOverCount = apiRecords.filter((r) => r.isOverThreshold).length;
        const exportOverCount = exportData.records.filter((r) => r.isOverThreshold).length;
        (0, vitest_1.expect)(wfOverCount).toBe(apiOverCount);
        (0, vitest_1.expect)(apiOverCount).toBe(exportOverCount);
        (0, vitest_1.expect)(wfOverCount).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=inspection.test.js.map