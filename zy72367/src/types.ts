export type ProcessingStatus =
  | "pending_review"
  | "confirmed_normal"
  | "confirmed_abnormal"
  | "overridden_by_average";

export interface SamplingIntervalNote {
  originalLineNumber: number;
  note: string;
  manualChange: string | null;
  currentStatus: ProcessingStatus;
  updatedAt: string;
}

export interface TensionRecord {
  id: string;
  originalLineNumber: number;
  timestamp: string;
  beltId: string;
  tensionValue: number;
  unit: string;
  temperature: number | null;
  temperatureCalibrationNote: string | null;
  samplingIntervalNote: SamplingIntervalNote | null;
  isOverThreshold: boolean;
  thresholdValue: number;
  processingStatus: ProcessingStatus;
  avgMasked: boolean;
  manualOverrides: ManualOverrideEntry[];
  importBatchId: string;
  importStep: ImportStep;
}

export interface ManualOverrideEntry {
  operator: string;
  previousValue: number;
  newValue: number;
  reason: string;
  timestamp: string;
}

export type ImportStep =
  | "first_import"
  | "temperature_calibration_review"
  | "unit_conversion_update";

export interface ImportResult {
  batchId: string;
  step: ImportStep;
  importedCount: number;
  duplicateSkipped: number;
  overThresholdCount: number;
  avgMaskedCount: number;
  records: TensionRecord[];
}

export interface InspectionResult {
  records: TensionRecord[];
  summary: InspectionSummary;
  generatedAt: string;
}

export interface InspectionSummary {
  totalRecords: number;
  overThresholdCount: number;
  avgMaskedButOverThresholdCount: number;
  pendingReviewCount: number;
  confirmedNormalCount: number;
  confirmedAbnormalCount: number;
}

export interface SelfTestResult {
  passed: boolean;
  testName: string;
  detail: string;
}
