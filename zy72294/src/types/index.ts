export interface RangefinderRecord {
  id: string;
  batchNo: string;
  pointX: number;
  pointY: number;
  distance: number;
  screenshotUrl: string;
  alarmOccluded: boolean;
  importBatch: string;
  createdAt: string;
  createdBy: string;
}

export interface VolumeEstimation {
  id: string;
  recordId: string;
  volume: number;
  calculationModel: 'cone' | 'cuboid' | 'irregular';
  paramVersion: string;
  tradeoffReason: string;
  calculationParams: Record<string, number>;
  calculatedAt: string;
}

export interface ObstacleNote {
  id: string;
  recordId: string;
  content: string;
  status: 'pending' | 'completed' | 'verify';
  updatedAt: string;
  updatedBy: string;
}

export interface AlarmReview {
  id: string;
  recordId: string;
  reviewStatus: 'pending' | 'normal' | 'abnormal' | 'onsite';
  reviewComment: string;
  reviewedAt: string;
  reviewedBy: string;
}

export interface SafetyReport {
  id: string;
  recordId: string;
  reason: string;
  missingMaterials: string[];
  nextStep: string;
  nextOwner: 'manager' | 'operator';
  status: 'draft' | 'confirmed' | 'exported';
  createdAt: string;
}

export interface ChangeHistory {
  id: string;
  entityType: 'obstacle_note' | 'safety_report' | 'alarm_review' | 'rangefinder_record';
  entityId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operatedAt: string;
}

export type WorkflowStep = 'import' | 'notes' | 'report';
export type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface DuplicateCheckResult {
  newRecords: RangefinderRecord[];
  duplicateRecords: RangefinderRecord[];
  skippedCount: number;
  addedCount: number;
}

export interface CalculationResult {
  volume: number;
  model: 'cone' | 'cuboid' | 'irregular';
  paramVersion: string;
  tradeoffReason: string;
  params: Record<string, number>;
}
