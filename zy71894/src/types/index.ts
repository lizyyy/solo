export interface ModificationLog {
  id: string;
  modifiedBy: string;
  modifiedAt: Date;
  oldContent: string;
  newContent: string;
  reason: string;
}

export interface TeamRecord {
  id: string;
  materialBatchId: string;
  teamId: string;
  operator: string;
  recordTime: Date;
  content: string;
  modifiedBy: string;
  modifiedAt: Date;
  status: 'normal' | 'warning' | 'error';
  isMissing: boolean;
  modificationHistory: ModificationLog[];
}

export interface ConditionLog {
  id: string;
  teamRecordId: string;
  conditionType: string;
  temperature: number;
  pressure: number;
  velocity: number;
  logTime: Date;
  operator: string;
  status: 'normal' | 'abnormal' | 'missing';
  isMissing: boolean;
}

export interface ThresholdTable {
  id: string;
  materialType: string;
  parameter: string;
  minValue: number;
  maxValue: number;
  unit: string;
  version: number;
  isDuplicate: boolean;
  duplicateOf?: string;
}

export interface ScheduleWarning {
  id: string;
  type: 'missing_team_record' | 'missing_condition_log' | 'duplicate_threshold' | 'boundary_condition' | 'parameter_out_of_range';
  message: string;
  severity: 'low' | 'medium' | 'high';
  sourceId?: string;
}

export interface TraceLink {
  id: string;
  scheduleId: string;
  sourceType: 'team_record' | 'condition_log' | 'threshold';
  sourceId: string;
  sourceName: string;
  sourceContent: string;
  sequence: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface ScheduleRecord {
  id: string;
  materialBatchId: string;
  materialType: string;
  scheduleTime: Date;
  status: 'pending' | 'scheduled' | 'completed' | 'failed' | 'warning';
  conclusion: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  updatedAt: Date;
  isReRun: boolean;
  originalScheduleId?: string;
  runCount: number;
  traceLinks: TraceLink[];
  warnings: ScheduleWarning[];
  recommendedStartTime?: Date;
  recommendedEndTime?: Date;
}

export interface InspectionReport {
  id: string;
  scheduleId: string;
  content: string;
  todoItems: string[];
  handoverNotes: string;
  exportedAt: Date;
  nextShiftRemarks: string;
}

export interface DataSources {
  teamRecords: TeamRecord[];
  conditionLogs: ConditionLog[];
  thresholds: ThresholdTable[];
}

export type ScheduleStatus = ScheduleRecord['status'];
export type Priority = ScheduleRecord['priority'];
