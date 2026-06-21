export interface WaterQualityParams {
  ph: number;
  dissolvedOxygen: number;
  turbidity: number;
  temperature: number;
  salinity: number;
  ammoniaNitrogen: number;
}

export interface Buoy {
  id: string;
  name: string;
  lat: number;
  lng: number;
  depth: number;
  status: 'normal' | 'warning' | 'danger';
  parameters: WaterQualityParams;
}

export interface AffectedArea {
  latRange: [number, number];
  lngRange: [number, number];
  radius: number;
}

export interface BuoyLog {
  id: string;
  buoyId: string;
  timestamp: number;
  parameters: WaterQualityParams;
  isBoundarySample: boolean;
  sourceRow?: string;
  affectedArea?: AffectedArea;
  remark?: string;
  anomalies: Anomaly[];
}

export type AnomalyType = 'parameter' | 'boundary' | 'trend';
export type AnomalyLevel = 'low' | 'medium' | 'high' | 'critical';
export type AnomalyStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface Anomaly {
  id: string;
  buoyId: string;
  logId?: string;
  timestamp: number;
  type: AnomalyType;
  level: AnomalyLevel;
  parameter?: keyof WaterQualityParams;
  value?: number;
  threshold?: number;
  status: AnomalyStatus;
  description: string;
  affectedArea?: AffectedArea;
  details?: string | Record<string, unknown>;
  handler?: string;
  handleNote?: string;
}

export interface FilterParams {
  parameter: keyof WaterQualityParams | 'all';
  riskLevel: AnomalyLevel | 'all';
  status: AnomalyStatus | 'all';
  type: AnomalyType | 'all';
  buoyIds: string[];
  timeRange?: [number, number];
}

export interface ImportResult {
  success: number;
  duplicates: number;
  boundarySamples: number;
  errors: string[];
}

export interface AppState {
  sceneReady: boolean;
  cameraPosition: [number, number, number];
  selectedBuoyId: string | null;
  selectedAnomalyId: string | null;
  expandedLogId: string | null;

  currentTime: number;
  timeRange: [number, number];
  isPlaying: boolean;
  playbackSpeed: number;

  filterParams: FilterParams;

  buoys: Buoy[];
  logs: BuoyLog[];
  anomalies: Anomaly[];

  setSceneReady: (ready: boolean) => void;
  setCameraPosition: (pos: [number, number, number]) => void;
  setSelectedBuoy: (id: string | null) => void;
  setSelectedAnomaly: (id: string | null) => void;
  setExpandedLog: (id: string | null) => void;

  setCurrentTime: (time: number, source?: 'scene' | 'timeline' | 'filter' | 'queue') => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;

  setFilter: (filter: Partial<FilterParams>, source?: 'scene' | 'timeline' | 'filter' | 'queue') => void;

  importLogs: (logs: BuoyLog[]) => {
    processedLogs: BuoyLog[];
    total: number;
    added: number;
    duplicates: number;
    preservedRemarks: number;
  };
  updateLogRemark: (logId: string, remark: string) => void;
  updateAnomalyStatus: (anomalyId: string, status: AnomalyStatus, note?: string) => void;

  getLogsByBuoyId: (buoyId: string) => BuoyLog[];
  getAnomaliesByLogId: (logId: string) => Anomaly[];
  getAnomaliesByBuoyId: (buoyId: string) => Anomaly[];
  getFilteredLogs: () => BuoyLog[];
  getFilteredAnomalies: () => Anomaly[];
}

export const PARAMETER_THRESHOLDS: Record<keyof WaterQualityParams, { min: number; max: number; unit: string; name: string }> = {
  ph: { min: 6.5, max: 8.5, unit: '', name: 'pH值' },
  dissolvedOxygen: { min: 5, max: 100, unit: 'mg/L', name: '溶解氧' },
  turbidity: { min: 0, max: 10, unit: 'NTU', name: '浊度' },
  temperature: { min: 0, max: 35, unit: '°C', name: '水温' },
  salinity: { min: 0, max: 40, unit: 'PSU', name: '盐度' },
  ammoniaNitrogen: { min: 0, max: 2, unit: 'mg/L', name: '氨氮' },
};

export const ANOMALY_LEVEL_COLORS: Record<AnomalyLevel, string> = {
  low: '#2ED573',
  medium: '#FFA502',
  high: '#FF6348',
  critical: '#FF4757',
};

export const ANOMALY_LEVEL_LABELS: Record<AnomalyLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重',
};

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  ignored: '已忽略',
};

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  parameter: '参数超标',
  boundary: '边界样本',
  trend: '趋势异常',
};
