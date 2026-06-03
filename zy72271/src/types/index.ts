export type RecordType = 'normal' | 'blocked-warning' | 'old-caliber';
export type RecordStatus = 
  | 'pending' 
  | 'cad-imported' 
  | 'under-review' 
  | 'pending-manager' 
  | 'corrected' 
  | 'report-generated';
export type ReviewResult = 'approved' | 'rejected' | null;

export interface CadLayer {
  id: string;
  recordId: string;
  name: string;
  color: string;
  objectCount: number;
  isValid: boolean;
  validationMessage?: string;
}

export interface RangefinderRecord {
  id: string;
  recordId: string;
  deviceId: string;
  distance: number;
  unit: string;
  caliber: string;
  measuredAt: string;
  photoUrl: string;
  hasBlockedWarning: boolean;
  needsCorrection: boolean;
  warningLabelVisible: boolean;
  originalDistance?: number;
  originalUnit?: string;
  originalCaliber?: string;
}

export interface Correction {
  id: string;
  rangefinderId: string;
  oldDistance: number;
  newDistance: number;
  oldCaliber: string;
  newCaliber: string;
  reason: string;
  correctedAt: string;
  operator: string;
}

export interface HistoryLog {
  id: string;
  recordId: string;
  step: string;
  action: string;
  operator: string;
  details: string;
  timestamp: string;
}

export interface SafetyReport {
  id: string;
  recordId: string;
  minDistance: number;
  requiredDistance: number;
  isSafe: boolean;
  warnings: string[];
  generatedAt: string;
  version: string;
  calculationDetails: {
    reflectionPoints: number;
    soundPathLength: number;
    decayRate: number;
  };
}

export interface WorkflowRecord {
  id: string;
  code: string;
  type: RecordType;
  typeLabel: string;
  status: RecordStatus;
  statusLabel: string;
  description: string;
  createdAt: string;
  cadLayers: CadLayer[];
  rangefinderRecords: RangefinderRecord[];
  corrections: Correction[];
  historyLogs: HistoryLog[];
  safetyReport?: SafetyReport;
  currentStep: number;
  reviewResult?: ReviewResult;
  reviewComment?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  suggestion: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: number;
}

export const STEP_NAMES = ['CAD 图层导入', '测距仪记录审核', '安全距离报告'] as const;
export type StepName = typeof STEP_NAMES[number];
