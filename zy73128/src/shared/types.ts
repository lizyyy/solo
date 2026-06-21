export type AnnotationStatus = '正常' | '补录' | '异常' | '云遮挡';
export type BleachingSeverity = '正常' | '轻度' | '中度' | '严重';
export type AuditAction = '创建' | '改判' | '编辑' | '补录' | '标记异常' | '确认' | '标记云遮挡' | '导出';

export interface ScreenshotMeta {
  dataSource: string;
  orbitId: string;
  pixelRange: string;
  resolution: string;
  bandCombo: string;
}

export interface CloudMask {
  id: string;
  annotationId: string;
  polygon: string;
  affectedArea: number;
  reviewSource: string;
  description: string;
}

export interface Annotation {
  id: string;
  station: string;
  sampleTime: string;
  experimentResult: string;
  bleachingArea: number;
  totalArea: number;
  severity: BleachingSeverity;
  sceneLabel: string;
  sideNote: string;
  status: AnnotationStatus;
  screenshotUrl: string;
  screenshotMeta: ScreenshotMeta;
  hasCloudCover: boolean;
  cloudMask?: CloudMask;
  badDataRef?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTrail {
  id: string;
  annotationId: string;
  operator: string;
  action: AuditAction;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  reason: string;
  screenshotAnchor?: string;
  timestamp: string;
}

export interface ExportBatch {
  batchId: string;
  exportTime: string;
  operator: string;
  annotationIds: string[];
  dataHash: string;
}
