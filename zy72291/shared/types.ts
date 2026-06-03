export type LogStatus = 'success' | 'blocked' | 'legacy' | 'pending_review';
export type AlertType = 'distance' | 'height' | 'obstacle' | 'occlusion';
export type AlertLevel = 'warning' | 'danger' | 'info';
export type RadiusVersion = 'new' | 'legacy';
export type WindSpeed = 'low' | 'medium' | 'high';
export type ReportStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
export type RecordType = 'success' | 'blocked' | 'legacy';
export type RadiusVersionReport = 'new' | 'legacy' | 'mixed';
export type UserRole = 'engineer' | 'manager';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  message: string;
  isOccluded: boolean;
  position: Position;
}

export interface PointCloudLog {
  id: string;
  timestamp: string;
  batchNo: string;
  pointCount: number;
  thinningRate: number;
  alerts: Alert[];
  status: LogStatus;
  source: string;
  hasScreenshotOcclusion: boolean;
  screenshotNote?: string;
  manualCorrection?: string;
  rerunCount: number;
}

export interface SafetyRadius {
  id: string;
  windDirection: number;
  windSpeed: WindSpeed;
  radius: number;
  version: RadiusVersion;
  effectiveDate: string;
  source: string;
}

export interface ReportResult {
  id: string;
  recordId: string;
  recordType: RecordType;
  safetyDistance: number;
  requiredDistance: number;
  compliance: boolean;
  note: string;
  windDirection: number;
  windSpeed: WindSpeed;
}

export interface SafetyReport {
  id: string;
  generatedAt: string;
  logIds: string[];
  radiusVersion: RadiusVersionReport;
  results: ReportResult[];
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  notes: string;
}

export interface OperationLog {
  id: string;
  operator: UserRole;
  operatorName: string;
  action: string;
  timestamp: string;
  detail: string;
  targetId?: string;
}

export interface WindDataPoint {
  direction: number;
  frequency: number;
  safetyDistance: number;
  requiredDistance: number;
}

export interface ProcessStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed';
  timestamp?: string;
}

export const STATUS_LABELS: Record<LogStatus, string> = {
  success: '顺利通过',
  blocked: '截图遮挡',
  legacy: '旧口径补录',
  pending_review: '待施工经理复核',
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  distance: '安全距离',
  height: '相对高度',
  obstacle: '障碍物',
  occlusion: '遮挡',
};

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  warning: '警告',
  danger: '危险',
  info: '提示',
};

export const WIND_SPEED_LABELS: Record<WindSpeed, string> = {
  low: '低速 (<6m/s)',
  medium: '中速 (6-12m/s)',
  high: '高速 (>12m/s)',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  success: '顺利记录',
  blocked: '截图遮挡',
  legacy: '旧口径补录',
};
