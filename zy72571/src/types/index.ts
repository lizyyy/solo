export type SampleStatus = 
  | 'normal' 
  | 'time_window_inflated' 
  | 'old_caliber' 
  | 'pending_review' 
  | 'reviewed' 
  | 'rejected';

export type AnomalyType = 'time_window' | 'old_caliber' | 'other';

export type ReviewStatus = 'pending_review' | 'reviewed' | 'rejected';

export type TargetType = 'note' | 'experiment' | 'anomaly';

export interface ThresholdNote {
  id: string;
  batchId: string;
  threshold: number;
  wakeRate: number;
  falseAlarmRate: number;
  timeWindowStart: string;
  timeWindowEnd: string;
  crossesTimeWindow: boolean;
  status: SampleStatus;
  createdAt: string;
  operator: string;
  source?: 'import' | 'experiment';
  caliberVersion?: string;
}

export interface ExperimentRecord {
  id: string;
  experimentName: string;
  caliberVersion: string;
  threshold: number;
  wakeRate: number;
  falseAlarmRate: number;
  isOldCaliber: boolean;
  imported: boolean;
  createdAt: string;
  description?: string;
}

export interface AnomalySample {
  id: string;
  noteId: string;
  type: AnomalyType;
  description: string;
  status: ReviewStatus;
  reviewer?: string;
  reviewComment?: string;
  createdAt: string;
  noteData?: ThresholdNote;
}

export interface HistoryRecord {
  id: string;
  action: string;
  operator: string;
  targetId: string;
  targetType: TargetType;
  detail: string;
  timestamp: string;
}

export interface AppState {
  thresholdNotes: ThresholdNote[];
  experiments: ExperimentRecord[];
  anomalies: AnomalySample[];
  history: HistoryRecord[];
  currentStep: number;
  selectedSampleId?: string;
  toasts: ToastMessage[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
}

export type AppAction =
  | { type: 'IMPORT_NOTES'; payload: ThresholdNote[] }
  | { type: 'IMPORT_FROM_EXPERIMENT'; payload: string }
  | { type: 'ADD_ANOMALY'; payload: AnomalySample }
  | { type: 'UPDATE_ANOMALY_STATUS'; payload: { id: string; status: ReviewStatus; reviewer?: string; comment?: string } }
  | { type: 'SUBMIT_FOR_REVIEW'; payload: string }
  | { type: 'REVIEW_ANOMALY'; payload: { id: string; passed: boolean; comment: string; reviewer: string } }
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'SELECT_SAMPLE'; payload: string | undefined }
  | { type: 'ADD_HISTORY'; payload: HistoryRecord }
  | { type: 'ADD_TOAST'; payload: ToastMessage }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'RERUN_CALIBRATION' }
  | { type: 'RESET_DEMO' };
