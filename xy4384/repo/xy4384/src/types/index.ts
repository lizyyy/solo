export interface WindSpeedPoint {
  timestamp: number;
  speed: number;
  altitude?: number;
  pressure?: number;
  temperature?: number;
}

export interface SixAxisForceData {
  timestamp: number;
  fx: number;
  fy: number;
  fz: number;
  mx: number;
  my: number;
  mz: number;
}

export interface SupportConfiguration {
  id: string;
  name: string;
  description: string;
  material: string;
  stiffness: number;
  naturalFrequency: number;
  dampingRatio: number;
  mountingType: string;
  createdAt: string;
}

export interface SensorCalibration {
  sensorId: string;
  sensorName: string;
  calibrationDate: string;
  expirationDate: string;
  calibrationFactor: number;
  offset: number;
  calibratedBy: string;
  certificateNumber: string;
}

export interface ManualNote {
  id: string;
  timestamp: number;
  author: string;
  content: string;
  category: 'observation' | 'warning' | 'issue' | 'other';
  attachments?: string[];
}

export interface TestRound {
  id: string;
  testNumber: string;
  testName: string;
  modelName: string;
  testDate: string;
  startTime: string;
  endTime: string;
  windSpeedProfile: WindSpeedPoint[];
  forceData: SixAxisForceData[];
  supportConfigId: string;
  sensorCalibrations: SensorCalibration[];
  manualNotes: ManualNote[];
  referenceArea: number;
  airDensity: number;
  metadata?: Record<string, unknown>;
}

export interface DragCoefficientDrift {
  id: string;
  testRoundId: string;
  driftAmount: number;
  driftPercentage: number;
  baselineValue: number;
  currentValue: number;
  startTime: number;
  endTime: number;
  severity: 'low' | 'medium' | 'high';
  isRejected: boolean;
  rejectionReason?: string;
}

export interface ResonanceWindow {
  id: string;
  testRoundId: string;
  frequencyStart: number;
  frequencyEnd: number;
  amplitude: number;
  windSpeedRange: { min: number; max: number };
  confidence: number;
  severity: 'low' | 'medium' | 'high';
  isRejected: boolean;
  rejectionReason?: string;
}

export interface CalibrationAlert {
  id: string;
  testRoundId: string;
  sensorId: string;
  sensorName: string;
  daysUntilExpiration: number;
  calibrationDate: string;
  expirationDate: string;
  isExpired: boolean;
  isRejected: boolean;
  rejectionReason?: string;
}

export interface AnomalySpike {
  id: string;
  testRoundId: string;
  timestamp: number;
  forceType: 'fx' | 'fy' | 'fz' | 'mx' | 'my' | 'mz';
  value: number;
  baselineValue: number;
  deviation: number;
  deviationPercentage: number;
  windSpeedAtTime: number;
  severity: 'low' | 'medium' | 'high';
  isRejected: boolean;
  rejectionReason?: string;
}

export interface AnalysisResult {
  testRoundId: string;
  analysisDate: string;
  dragCoefficientDrifts: DragCoefficientDrift[];
  resonanceWindows: ResonanceWindow[];
  calibrationAlerts: CalibrationAlert[];
  anomalySpikes: AnomalySpike[];
  overallStatus: 'normal' | 'warning' | 'critical';
  summary: string;
}

export interface ReviewRecord {
  id: string;
  testRoundId: string;
  reviewer: string;
  reviewDate: string;
  comments: string;
  status: 'pending' | 'approved' | 'approved_with_notes' | 'rejected';
  decisions: {
    type: 'drift' | 'resonance' | 'calibration' | 'spike';
    itemId: string;
    decision: 'accept' | 'reject' | 'further_investigation';
    reason?: string;
  }[];
}

export interface RiskItem {
  id: string;
  testRoundId: string;
  testNumber: string;
  category: 'drift' | 'resonance' | 'calibration' | 'spike';
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'ignored';
  resolvedBy?: string;
  resolvedAt?: string;
  notes?: string;
}

export interface ImportResult {
  success: boolean;
  testRounds: TestRound[];
  errors: string[];
  warnings: string[];
}

export type ExportFormat = 'markdown' | 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  includeCharts?: boolean;
  includeRawData?: boolean;
  testRoundIds?: string[];
}
