export type AnomalyType = 
  | 'sampling_shift' 
  | 'temp_over_limit' 
  | 'missing_load' 
  | 'duplicate_data' 
  | 'supplement_data';

export type AnomalySeverity = 'warning' | 'error' | 'critical';
export type AnomalyStatus = 'detected' | 'confirmed' | 'resolved' | 'dismissed';

export interface AnomalyDetail {
  shiftOffset?: number;
  shiftConfidence?: number;
  tempValue?: number;
  tempLimit?: number;
  tempDuration?: number;
  tempRiseRate?: number;
  missingLoadRange?: [number, number];
  inferredLoadLevel?: number;
  inferenceConfidence?: number;
  duplicateBatchIds?: string[];
  supplementBatchId?: string;
}

export interface CorrectedData {
  torque?: number;
  loadLevel?: number;
  shiftOffset?: number;
  temperature?: number;
}

export interface Anomaly {
  id?: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  status: AnomalyStatus;
  deviceId: string;
  detectedAt: number;
  description: string;
  detail: AnomalyDetail;
  affectedSampleIds: string[];
  affectedSegmentIds: string[];
  confirmedBy?: string;
  confirmedAt?: number;
  confirmedNote?: string;
  correctedData?: CorrectedData;
  createdAt: number;
  updatedAt: number;
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  sampling_shift: '采样错位',
  temp_over_limit: '温升超限',
  missing_load: '负载档漏记',
  duplicate_data: '重复数据',
  supplement_data: '补录数据',
};

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  warning: '预警',
  error: '异常',
  critical: '严重',
};

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  detected: '待处理',
  confirmed: '已确认',
  resolved: '已解决',
  dismissed: '已忽略',
};
