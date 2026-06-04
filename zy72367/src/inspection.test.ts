import { describe, it, expect, beforeEach } from "vitest";
import { runSelfTests } from "./self-test/index.js";
import {
  resetWorkflow,
  runFirstImport,
  runTemperatureCalibrationReview,
  runUnitConversionUpdate,
  getWorkflowResult,
  advanceStep,
} from "./workflow/index.js";
import { apiGetRecords, apiGetSummary, apiGetExportData } from "./api/handler.js";
import type { ThresholdConfig } from "./core/processor.js";

const config: ThresholdConfig = { upperLimit: 100, lowerLimit: 20, unit: "N" };

function makeSampleData(count: number, baseValue: number) {
  return Array.from({ length: count }, (_, i) => ({
    originalLineNumber: i + 1,
    timestamp: `2024-01-${String(i + 1).padStart(2, "0")}T08:00:00Z`,
    beltId: `BELT-${String((i % 3) + 1).padStart(2, "0")}`,
    tensionValue: baseValue + (i % 5) * 2,
    unit: "N",
    temperature: 25 + (i % 3),
  }));
}

describe("self-test", () => {
  it("all self-tests pass", () => {
    const results = runSelfTests();
    for (const r of results) {
      expect(r.passed).toBe(true);
    }
  });
});

describe("three-step workflow", () => {
  beforeEach(() => {
    resetWorkflow();
  });

  it("step 1: first import", () => {
    const result = runFirstImport(makeSampleData(8, 50), config);
    expect(result.step).toBe("first_import");
    expect(result.importedCount).toBe(8);
  });

  it("step 2: temperature calibration review restores avg-masked to pending_review", () => {
    runFirstImport(makeSampleData(8, 50), config);
    advanceStep();
    const result = runTemperatureCalibrationReview(
      [{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }],
      config
    );
    const maskedButOver = result.records.filter((r) => r.avgMasked && r.isOverThreshold);
    for (const r of maskedButOver) {
      expect(r.processingStatus).toBe("pending_review");
    }
  });

  it("step 3: unit conversion update keeps avg-masked over-threshold as pending_review", () => {
    runFirstImport(makeSampleData(8, 50), config);
    advanceStep();
    runTemperatureCalibrationReview(
      [{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }],
      config
    );
    advanceStep();
    const result = runUnitConversionUpdate(
      [{ beltId: "BELT-01", fromUnit: "N", toUnit: "kN", factor: 0.001 }],
      config
    );
    const maskedButOver = result.records.filter((r) => r.avgMasked && r.isOverThreshold);
    for (const r of maskedButOver) {
      expect(r.processingStatus).toBe("pending_review");
    }
  });
});

describe("single source of truth", () => {
  beforeEach(() => {
    resetWorkflow();
  });

  it("api and workflow return same records", () => {
    runFirstImport(makeSampleData(5, 50), config);
    advanceStep();
    runTemperatureCalibrationReview(
      [{ beltId: "BELT-01", timestamp: "2024-01-01T08:00:00Z", calibrationNote: "calibrated", temperature: 27 }],
      config
    );
    const workflowResult = getWorkflowResult();
    const apiRecords = apiGetRecords();
    const exportData = apiGetExportData() as any;

    expect(apiRecords.length).toBe(workflowResult.records.length);
    expect(exportData.records.length).toBe(workflowResult.records.length);
    for (let i = 0; i < apiRecords.length; i++) {
      expect(apiRecords[i].id).toBe(workflowResult.records[i].id);
      expect(exportData.records[i].beltId).toBe(workflowResult.records[i].beltId);
    }
  });

  it("over-threshold records never disappear in any view", () => {
    const data = [
      ...makeSampleData(8, 50),
      { originalLineNumber: 9, timestamp: "2024-01-09T08:00:00Z", beltId: "BELT-01", tensionValue: 105, unit: "N", temperature: 25 },
    ];
    runFirstImport(data, config);

    const workflowResult = getWorkflowResult();
    const apiRecords = apiGetRecords();
    const exportData = apiGetExportData() as any;

    const wfOverCount = workflowResult.records.filter((r) => r.isOverThreshold).length;
    const apiOverCount = apiRecords.filter((r) => r.isOverThreshold).length;
    const exportOverCount = exportData.records.filter((r: any) => r.isOverThreshold).length;

    expect(wfOverCount).toBe(apiOverCount);
    expect(apiOverCount).toBe(exportOverCount);
    expect(wfOverCount).toBeGreaterThan(0);
  });
});
