export type PointStatus = 'normal' | 'pending' | 'anomaly';

export type AnomalyType =
  | 'coordinate_offset'
  | 'duplicate_name'
  | 'missing_photo'
  | 'cross_floor'
  | 'coordinate_mismatch';

export type DataSource = 'primary' | 'gis_legacy' | 'manual';

export interface DiffRecord {
  timestamp: string;
  operator: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export interface SoundFieldPoint {
  id: string;
  name: string;
  instrument: string;
  x: number;
  y: number;
  coordinateSystem: string;
  floor: number;
  status: PointStatus;
  photoUrl?: string;
  dataSource: DataSource;
  anomalies: AnomalyType[];
  judgmentProcess: string;
  remark?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  diffHistory: DiffRecord[];
}

export interface AnalysisParams {
  frequencyMin: number;
  frequencyMax: number;
  sampleRate: number;
  soundFieldThreshold: number;
  coordinateSystem: string;
  autoDetect: boolean;
}

export type OperationAction = 'import' | 'param_change' | 'confirm' | 'remark' | 'export';

export interface OperationLog {
  id: string;
  operator: string;
  action: OperationAction;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
  reason?: string;
}

export interface AnalysisReport {
  id: string;
  generatedAt: string;
  generatedBy: string;
  params: AnalysisParams;
  summary: {
    totalPoints: number;
    normalCount: number;
    pendingCount: number;
    anomalyCount: number;
    anomalies: Record<AnomalyType, number>;
  };
  judgmentProcess: string[];
  points: SoundFieldPoint[];
}

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  coordinate_offset: '坐标偏移',
  duplicate_name: '设备重名',
  missing_photo: '缺照片',
  cross_floor: '跨楼层',
  coordinate_mismatch: '坐标系不一致',
};

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  primary: '主数据源',
  gis_legacy: 'GIS旧口径',
  manual: '人工补录',
};

export const STATUS_LABELS: Record<PointStatus, string> = {
  normal: '正常',
  pending: '待确认',
  anomaly: '异常',
};

export const COORDINATE_SYSTEMS = ['CGCS2000', 'WGS84', 'BD-09', 'GCJ-02'] as const;
