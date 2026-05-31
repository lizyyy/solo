export type WarningStatus = 'normal' | 'warning' | 'fault';

export type OperationType = 'threshold_early' | 'repair_late' | 'vibration_modified';

export type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Warning {
  id: string;
  deviceId: string;
  deviceName: string;
  status: WarningStatus;
  temperature: number;
  vibration: number;
  createdAt: string;
  updatedAt: string;
}

export interface Threshold {
  id: string;
  warningId: string;
  metric: string;
  minValue: number;
  maxValue: number;
  actualValue: number;
  isBackfilled: boolean;
  submittedAt: string;
  expectedAt: string;
}

export interface VibrationData {
  id: string;
  warningId: string;
  timestamp: string;
  value: number;
  isManuallyModified: boolean;
  modifiedBy?: string;
  modifiedAt?: string;
}

export interface FaultJudgment {
  id: string;
  warningId: string;
  isAbnormal: boolean;
  reproductionOrder: string;
  judgmentReason: string;
  basis: string[];
  judgedAt: string;
}

export interface OperationLog {
  id: string;
  warningId: string;
  type: OperationType;
  operator: string;
  operatedAt: string;
  description: string;
  affectsConclusion: boolean;
  beforeChange?: string;
  afterChange?: string;
}

export interface BatchTask {
  id: string;
  idempotencyKey: string;
  warningIds: string[];
  status: BatchStatus;
  processedCount: number;
  totalCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface ViewState {
  page: string;
  filters: FilterOptions;
  scrollTop: number;
  expandedIds: string[];
  chartRange: {
    start: string;
    end: string;
  };
}

export interface ForemanViewData {
  warningId: string;
  deviceName: string;
  status: WarningStatus;
  plainReason: string;
  nextSteps: {
    id: string;
    order: number;
    description: string;
    completed: boolean;
  }[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface WarningDetail extends Warning {
  thresholds: Threshold[];
  vibrationData: VibrationData[];
  faultJudgment: FaultJudgment;
  operationLogs: OperationLog[];
  foremanData: ForemanViewData;
}

export interface FilterOptions {
  status?: WarningStatus;
  deviceName?: string;
  startDate?: string;
  endDate?: string;
}
