export type ISO8601 = string;

export type ScheduleConclusion =
  | 'normal'
  | 'anomaly'
  | 'pending'
  | 'rejudged_normal'
  | 'rejudged_anomaly';

export type ScheduleStatus =
  | 'draft'
  | 'reviewing'
  | 'handoff_ready'
  | 'handoff_missing'
  | 'closed';

export type HandoffStatus = 'releasable' | 'missing_material' | 'pending';

export type LogStatus = 'normal' | 'anomaly' | 'gap';
export type AnomalyType =
  | 'over_threshold'
  | 'spike'
  | 'drift'
  | 'sensor_offline';

export interface SensorLog {
  id: string;
  scheduleId: string;
  timestamp: ISO8601;
  sensorId: string;
  bearingCode: string;
  rawValue: number;
  status: LogStatus;
  anomalyType?: AnomalyType;
  rawDescription: string;
  materialBatchNo?: string;
  createdAt: ISO8601;
}

export interface Material {
  id: string;
  batchNo: string;
  name: string;
  spec: string;
  qty: number;
  inboundNo: string;
  supplier: string;
  scheduleIds: string[];
  receivedAt: ISO8601;
  remark?: string;
}

export type ProcessRecordType = 'note' | 'supplement' | 'rejudge';

export interface ProcessRecord {
  id: string;
  scheduleId: string;
  type: ProcessRecordType;
  operator: string;
  content: string;
  oldConclusion?: ScheduleConclusion;
  newConclusion?: ScheduleConclusion;
  rejudgeReason?: string;
  affectedLogIds?: string[];
  timestamp: ISO8601;
}

export interface HistoryVersion {
  id: string;
  scheduleId: string;
  versionNo: number;
  snapshot: {
    conclusion: ScheduleConclusion;
    remark: string;
    materialBatchNos: string[];
    status: ScheduleStatus;
  };
  changeSummary: string;
  operator: string;
  createdAt: ISO8601;
}

export interface BearingSchedule {
  id: string;
  scheduleNo: string;
  bridgeName: string;
  bearingCode: string;
  position: string;
  conclusion: ScheduleConclusion;
  status: ScheduleStatus;
  handoff: HandoffStatus;
  primaryRemark: string;
  logIds: string[];
  materialBatchNos: string[];
  versionCount: number;
  createdAt: ISO8601;
  updatedAt: ISO8601;
}

export interface ChartPoint {
  time: string;
  timestamp: number;
  rawValue: number;
  avgValue?: number;
  status: LogStatus;
  anomalyType?: AnomalyType;
  logId: string;
  rawDescription: string;
}
