export interface StudentRecord {
  studentId: string;
  studentName: string;
  groupId?: string;
  experimentDate: string;
}

export interface RawCollisionData {
  recordId: string;
  ballMass: number;
  ballDiameter: number;
  initialHeight: number;
  horizontalDisplacement: number;
  collisionDisplacement: number;
  notes?: string;
}

export interface CollisionCalculation {
  initialVelocity: number;
  initialMomentum: number;
  collisionVelocity: number;
  collisionMomentum: number;
  momentumLossRate: number;
  kineticEnergyBefore: number;
  kineticEnergyAfter: number;
  energyLossRate: number;
}

export interface Anomaly {
  type: 'momentum_loss' | 'energy_loss' | 'unit_error' | 'outlier' | 'missing_data';
  severity: 'warning' | 'error' | 'info';
  message: string;
  explanation: string;
  suggestion: string;
  field?: string;
  expectedRange?: [number, number];
  actualValue?: number;
}

export interface GradingRecord {
  gradedBy: string;
  gradedAt: string;
  score: number;
  comments: string;
  previousScore?: number;
  previousComments?: string;
}

export interface CollisionRecord {
  id: string;
  student: StudentRecord;
  rawData: RawCollisionData;
  calculation: CollisionCalculation;
  anomalies: Anomaly[];
  grading?: GradingRecord;
  status: 'pending' | 'imported' | 'reviewed' | 'graded' | 'withdrawn';
  createdAt: string;
  updatedAt: string;
  version: number;
  importBatchId: string;
}

export interface CalibrationConfig {
  id: string;
  name: string;
  unit: string;
  standardValue: number;
  tolerance: number;
  conversionFactor: number;
  description: string;
}

export interface CalibrationTable {
  version: string;
  effectiveDate: string;
  configs: CalibrationConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  recordId: string;
  action: 'import' | 'update' | 'grade' | 'withdraw' | 'restore' | 'anomaly_fixed';
  timestamp: string;
  operator: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  reason?: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importTime: string;
  recordCount: number;
  operator: string;
  status: 'completed' | 'partial' | 'rolled_back';
  rollbackReason?: string;
}

export interface FilterCriteria {
  studentId?: string;
  studentName?: string;
  groupId?: string;
  experimentDateFrom?: string;
  experimentDateTo?: string;
  status?: CollisionRecord['status'][];
  hasAnomalies?: boolean;
  anomalyTypes?: Anomaly['type'][];
  minScore?: number;
  maxScore?: number;
  importBatchId?: string;
}

export interface ExportConfig {
  includeCalculations: boolean;
  includeAnomalies: boolean;
  includeGrading: boolean;
  includeHistory: boolean;
  format: 'csv' | 'xlsx';
  filename?: string;
}

export interface UnitConversionError {
  recordId: string;
  field: string;
  rawValue: string;
  expectedUnit: string;
  detectedUnit?: string;
  suggestion: string;
}
