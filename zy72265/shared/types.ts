export type CoordinateType = 'LAT_LNG' | 'METRIC' | 'MIXED';
export type ProcessingStatus = 'IMPORTED' | 'ENGINEER_REVIEW' | 'INSPECTION_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ROLLBACK';
export type AuditActionType = 'IMPORT' | 'EDIT' | 'STATUS_CHANGE' | 'REVIEW' | 'CORRECT' | 'ROLLBACK';
export type RadiusSource = 'LOG' | 'TABLE' | 'MANUAL' | null;
export type RuleType = 'DETECTION' | 'CORRECTION' | 'ROLLBACK';
export type WorkflowStep = 1 | 2 | 3;

export interface CoordinatePoint {
  id: string;
  envelopeId: string;
  originalLineNumber: number;
  rawValue: string;
  xValue: number;
  yValue: number;
  coordinateType: CoordinateType;
  isMixed: boolean;
  status: ProcessingStatus;
  safetyRadius: number | null;
  radiusSource: RadiusSource;
  createdAt: string;
  updatedAt: string;
}

export interface EnvelopeRecord {
  id: string;
  robotArmId: string;
  calculationDate: string;
  safetyRadiusVersion: string;
  status: ProcessingStatus;
  totalPoints: number;
  mixedPoints: number;
  currentStep: WorkflowStep;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  envelopeId: string;
  pointId: string | null;
  actionType: AuditActionType;
  originalValue: string | null;
  newValue: string | null;
  operator: string;
  remark: string;
  timestamp: string;
  originalLineNumber: number | null;
}

export interface BoundaryRule {
  id: string;
  ruleType: RuleType;
  ruleName: string;
  condition: string;
  action: string;
  isActive: boolean;
  codeReference: string;
  description: string;
}

export interface SafetyRadiusTable {
  id: string;
  version: string;
  armModel: string;
  distance: number;
  radius: number;
  effectiveDate: string;
}

export interface ImportLogRequest {
  robotArmId: string;
  safetyRadiusVersion: string;
  fileContent: string;
  createdBy: string;
}

export interface ReviewPointRequest {
  pointId: string;
  action: 'CONFIRM_LAT_LNG' | 'CONFIRM_METRIC' | 'CORRECT' | 'ROLLBACK';
  xValue?: number;
  yValue?: number;
  safetyRadius?: number;
  remark: string;
  operator: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface WorkflowStepInfo {
  step: WorkflowStep;
  name: string;
  description: string;
  status: 'pending' | 'current' | 'completed';
}

export interface DetectionResult {
  isLatLng: boolean;
  isMetric: boolean;
  isMixed: boolean;
  coordinateType: CoordinateType;
  xValue: number;
  yValue: number;
}
