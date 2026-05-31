export type TimeSystem = 'UTC' | 'TAI' | 'BEIJING';

export type RecordType = 'SUPPLEMENT' | 'REAL_CHANGE';

export type BudgetStatus = 'NORMAL' | 'WARNING' | 'ERROR';
export type AnomalyStatus = 'PENDING' | 'CONFIRMED' | 'RESOLVED';
export type AnomalyType = 'TIME_CONFLICT' | 'DATA_INCONSISTENCY' | 'BUDGET_OVERRUN';
export type AnomalySeverity = 'WARNING' | 'ERROR';

export interface PayloadPlan {
  id: string;
  name: string;
  timeSystem: TimeSystem;
  startTime: string;
  endTime: string;
  powerConsumption: number;
  planType: 'NORMAL' | 'ADVANCED' | 'DELAYED';
  recordType: RecordType;
  operator: string;
  createdAt: string;
  remark: string;
}

export interface FaultRecord {
  id: string;
  description: string;
  timeSystem: TimeSystem;
  faultTime: string;
  duration: number;
  powerIncrement: number;
  recordType: RecordType | 'FAULT_OCCUR';
  operator: string;
  createdAt: string;
  remark: string;
}

export interface OrbitElement {
  id: string;
  parameterName: string;
  timeSystem: TimeSystem;
  effectiveTime: string;
  oldValue: number;
  newValue: number;
  isManualChange: boolean;
  recordType: RecordType;
  operator: string;
  createdAt: string;
  remark: string;
}

export interface AnomalyReason {
  formula: string;
  rawData: Array<{
    source: string;
    value: number | string;
    time: string;
    timeSystem: TimeSystem;
  }>;
  criteria: string;
  calculationSteps: string[];
  conclusion: string;
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  reason: string;
  relatedRecordIds: string[];
  status: AnomalyStatus;
  reviewer?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewRemark?: string;
}

export interface StateSnapshot {
  id: string;
  timestamp: string;
  hash: string;
  payloadData: string;
  faultData: string;
  orbitData: string;
  operator: string;
  description: string;
}

export interface AuditLog {
  id: string;
  recordType: 'PAYLOAD' | 'FAULT' | 'ORBIT';
  recordId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  operator: string;
  timestamp: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface DailyBudget {
  date: string;
  totalBudget: number;
  actualConsumption: number;
  margin: number;
  status: BudgetStatus;
  payloadCount: number;
  faultCount: number;
  anomalyCount: number;
}

export type TabType = 'payload' | 'fault' | 'orbit';
