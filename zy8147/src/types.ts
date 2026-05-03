export interface DeviceProfile {
  stationId: string;
  deviceModel: string;
  stx: string;
  etx: string;
  unit: 'kg' | 'g' | 'lb';
  tare: number;
  precision: number;
  frameFormat: 'type1' | 'type2' | 'type3';
}

export interface CalibrationRecord {
  stationId: string;
  calibrationDate: Date;
  expireDate: Date;
  calibratedBy: string;
  certificateNumber: string;
}

export interface BatchRecord {
  batchId: string;
  startTime: Date;
  endTime: Date;
  productId: string;
  productName: string;
  targetWeight: number;
  toleranceMin: number;
  toleranceMax: number;
  stationId: string;
}

export interface ParsedFrame {
  raw: string;
  stationId: string;
  timestamp: Date;
  weight: number;
  unit: string;
  status: 'stable' | 'unstable' | 'error';
  frameType: string;
  isDuplicate: boolean;
}

export interface StationState {
  stationId: string;
  currentWeight: number;
  stableWeight: number | null;
  tare: number;
  unit: string;
  lastStableTime: Date | null;
  frames: ParsedFrame[];
  consecutiveStable: number;
}

export interface Issue {
  id: string;
  type: IssueType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  stationId: string;
  description: string;
  details: Record<string, unknown>;
  relatedFrame?: ParsedFrame;
}

export type IssueType =
  | 'calibration_expired'
  | 'weight_jump'
  | 'duplicate_frame'
  | 'midnight_batch_misalignment'
  | 'bad_frame'
  | 'weight_out_of_tolerance'
  | 'unstable_reading'
  | 'missing_data';

export interface AnalysisResult {
  stationStates: Record<string, StationState>;
  issues: Issue[];
  weighingEvents: WeighingEvent[];
  summary: AnalysisSummary;
}

export interface WeighingEvent {
  id: string;
  stationId: string;
  batchId: string | null;
  startTime: Date;
  endTime: Date;
  stableWeight: number;
  netWeight: number;
  unit: string;
  frames: ParsedFrame[];
  status: 'ok' | 'warning' | 'error';
}

export interface AnalysisSummary {
  totalFrames: number;
  validFrames: number;
  invalidFrames: number;
  duplicateFrames: number;
  totalIssues: number;
  issuesByType: Record<IssueType, number>;
  weighingEvents: number;
  stationsAnalyzed: string[];
  analysisTime: Date;
}
