export type TemperatureUnit = 'Celsius' | 'Kelvin';

export type ThresholdStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

export type WorkflowStep = 'import' | 'engineer_review' | 'coach_review' | 'report';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type UserRole = 'engineer' | 'coach';

export interface ThresholdData {
  id: string;
  name: string;
  value: number;
  unit: TemperatureUnit;
  deviceId: string;
  remark: string;
  status: ThresholdStatus;
  calculationModel?: string;
  modelVersion?: string;
  tradeOffReason?: string;
  hasUnitMix: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryRecord {
  id: string;
  thresholdId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
  changeReason: string;
}

export interface WorkflowTask {
  id: string;
  thresholdId: string;
  step: WorkflowStep;
  status: TaskStatus;
  assignee: UserRole;
  previousStep?: WorkflowStep;
  nextStep?: WorkflowStep;
  createdAt: string;
  completedAt?: string;
}

export interface HandoverReport {
  id: string;
  thresholdId: string;
  content: string;
  retentionReason: string;
  missingMaterials: string[];
  nextAction: string;
  assigneeRole: UserRole;
  createdBy: string;
  createdAt: string;
}

export interface Device {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  nameplateParams: {
    ratedTemperature: number;
    temperatureUnit: TemperatureUnit;
    [key: string]: any;
  };
}

export interface ImportResult {
  success: number;
  duplicate: number;
  error: number;
  messages: string[];
}
