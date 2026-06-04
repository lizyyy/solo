export type TemperatureUnit = 'C' | 'K';

export type TaskStatus = 
  | 'importing'
  | 'pending_review'
  | 'photo_added'
  | 'reviewing'
  | 'completed';

export type NextAction = 'contact_coach' | 'contact_laotang';

export interface SensorData {
  id: string;
  sensorNo: string;
  timestamp: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  vibration: number;
  position: string;
  needsReview?: boolean;
}

export interface WorkPhoto {
  id: string;
  diagnosisId: string;
  url: string;
  thumbnail: string;
  filename: string;
  uploadTime: string;
  uploadBy: string;
  description: string;
  nodeIndex: number;
}

export interface CorrectionRecord {
  id: string;
  diagnosisId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

export interface HandoverReport {
  id: string;
  diagnosisId: string;
  problemStatement: string;
  missingMaterials: string[];
  nextAction: NextAction;
  nextHandler: string;
  generatedAt: string;
  updatedAt: string;
  version: number;
  versionHistory: ReportVersion[];
}

export interface ReportVersion {
  version: number;
  updatedAt: string;
  changes: string[];
}

export interface DiagnosisTask {
  id: string;
  title: string;
  status: TaskStatus;
  currentStep: number;
  sensorData: SensorData[];
  photos: WorkPhoto[];
  corrections: CorrectionRecord[];
  report: HandoverReport | null;
  hasUnitMixing: boolean;
  unitMixingInfo: UnitMixingInfo | null;
  createdAt: string;
  createdBy: string;
}

export interface UnitMixingInfo {
  hasMixing: boolean;
  celsiusCount: number;
  kelvinCount: number;
  affectedRows: string[];
}

export interface OperationLog {
  id: string;
  diagnosisId: string;
  action: string;
  details: Record<string, unknown>;
  operator: string;
  timestamp: string;
}

export interface ReplayCommand {
  command: string;
  description: string;
  timestamp: string;
}

export type StepStatus = 'completed' | 'active' | 'pending';

export interface StepInfo {
  step: number;
  title: string;
  description: string;
  status: StepStatus;
}
