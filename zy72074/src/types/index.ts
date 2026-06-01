export type PointStatus = 'success' | 'pending' | 'legacy';
export type SourceType = 'satellite' | 'inspection' | 'manual' | 'legacy';

export interface CameraState {
  lat: number;
  lng: number;
  altitude: number;
}

export interface RemarkItem {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

export interface Point {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: PointStatus;
  isAnomaly: boolean;
  changeType: string;
  changeRate: number;
  sourceType: SourceType;
  sourceDetail: string;
  sourceRow: string;
  handler: string;
  handledAt: string;
  judgement: string;
  remarks: RemarkItem[];
  cameraState: CameraState;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  cameraState: CameraState;
  pointIds: string[];
  pointStates: Record<string, { status: PointStatus; isAnomaly: boolean }>;
}

export interface AppSettings {
  autoRotate: boolean;
  filterStatus: PointStatus | 'all';
  lastCameraState: CameraState | null;
}

export interface ExportMetadata {
  planName: string;
  exportTime: string;
  pointName: string;
  judgement: string;
  handler: string;
  handledAt: string;
}

export const STATUS_COLORS: Record<PointStatus, string> = {
  success: '#10b981',
  pending: '#f59e0b',
  legacy: '#64748b',
};

export const STATUS_LABELS: Record<PointStatus, string> = {
  success: '顺利处理',
  pending: '待人工确认',
  legacy: '旧口径补录',
};

export const SOURCE_LABELS: Record<SourceType, string> = {
  satellite: '卫星影像',
  inspection: '巡检照片',
  manual: '手改坐标',
  legacy: '历史数据',
};

export const ANOMALY_COLOR = '#ef4444';
