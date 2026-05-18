export enum ExitCode {
  SUCCESS = 0,
  PARTIAL_SUCCESS = 1,
  ERROR_INVALID_INPUT = 2,
  ERROR_CONFIG_NOT_FOUND = 3,
  ERROR_PROCESSING_FAILED = 4,
  ERROR_NO_RECORDS = 5,
}

export enum DamageSeverity {
  MINOR = "minor",
  MODERATE = "moderate",
  SEVERE = "severe",
  CRITICAL = "critical",
}

export enum DamageCategory {
  BASE_SCRATCH = "base_scratch",
  EDGE_DAMAGE = "edge_damage",
  TOP_SHEET_CRACK = "top_sheet_crack",
  BINDING_MALFUNCTION = "binding_malfunction",
  CORE_EXPOSURE = "core_exposure",
  DELAMINATION = "delamination",
  TIP_TAIL_DAMAGE = "tip_tail_damage",
  UNKNOWN = "unknown",
}

export enum PhotoAngle {
  TOP = "top",
  BOTTOM = "bottom",
  SIDE = "side",
  TIP = "tip",
  TAIL = "tail",
  BINDING = "binding",
}

export interface DamageRecord {
  id: string;
  equipmentId: string;
  equipmentType: "ski" | "snowboard" | "boot" | "pole" | "helmet";
  reportDate: string;
  reporter: string;
  description: string;
  location: string;
  photoAngles: PhotoAngle[];
  previousDamageIds: string[];
  isRepairable: boolean;
  estimatedRepairCost?: number;
}

export interface ClassifiedDamage extends DamageRecord {
  category: DamageCategory;
  severity: DamageSeverity;
  isOldDamageRecurrence: boolean;
  hasMissingPhotoAngles: boolean;
  missingPhotoAngles: PhotoAngle[];
  classificationConfidence: number;
  notes: string[];
}

export interface ClassificationRule {
  id: string;
  name: string;
  description: string;
  category: DamageCategory;
  severity: DamageSeverity;
  keywords: string[];
  locationKeywords?: string[];
  photoAngleRequirements: PhotoAngle[];
  confidence: number;
}

export interface ClassifierConfig {
  rules: ClassificationRule[];
  defaultConfidence: number;
  requiredPhotoAngles: PhotoAngle[];
  oldDamageRecurrenceKeywords: string[];
}

export interface ClassificationResult {
  totalRecords: number;
  successfullyClassified: number;
  partiallyClassified: number;
  failedRecords: number;
  oldDamageRecurrences: number;
  missingPhotoAngleCases: number;
  results: ClassifiedDamage[];
  warnings: string[];
  errors: string[];
}

export interface ClassifierOptions {
  verbose?: boolean;
  outputPath?: string;
  reproducible?: boolean;
}
