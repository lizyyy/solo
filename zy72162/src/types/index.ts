export enum PointStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CONFLICT = 'conflict',
  MERGED = 'merged',
}

export enum SourceType {
  GIS = 'gis',
  RESIDENT = 'resident',
  INSPECTION = 'inspection',
  STREET = 'street',
}

export type ActionType = 'import' | 'merge' | 'split' | 'confirm' | 'reject' | 'export' | 'update';

export interface SourceRawData {
  name?: string;
  lat?: number;
  lng?: number;
  exifLat?: number;
  exifLng?: number;
  coordinates?: number[];
  address?: string;
  street?: string;
  description?: string;
  contact?: string;
  phone?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  photoId?: string;
  content?: string;
  lineNumber?: number;
  [key: string]: unknown;
}

export interface SourceData {
  id: string;
  pointId: string;
  sourceType: SourceType;
  sourceName: string;
  rawData: SourceRawData;
  photoUrl?: string;
  operator: string;
  importedAt: Date;
  confidence: number;
}

export interface GarbagePoint {
  id: string;
  canonicalName: string;
  lat: number;
  lng: number;
  address: string;
  street: string;
  status: PointStatus;
  mergeReason: string;
  sources: SourceData[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OperationLog {
  id: string;
  pointId: string;
  action: ActionType;
  operator: string;
  timestamp: Date;
  detail: string;
  evidence?: string;
}

export interface MergeConfig {
  id?: string;
  nameSimilarityThreshold: number;
  distanceThreshold: number;
  autoMergeConfidence: number;
}

export interface MergeCandidate {
  targetPoint: GarbagePoint;
  sourceData: SourceData;
  nameSimilarity: number;
  distance: number;
  confidence: number;
  reason: string;
}

export interface ConflictInfo {
  type: 'name' | 'location' | 'address' | 'multiple_sources';
  description: string;
  evidence: {
    source: SourceData;
    value: string;
  }[];
}

export interface ImportPreview {
  file: File;
  type: SourceType;
  total: number;
  valid: number;
  invalid: number;
  samples: unknown[];
  fieldMapping: Record<string, string>;
  errors: string[];
}

export interface ExportConfig {
  format: 'xlsx' | 'pdf';
  columns: string[];
  filters: {
    streets?: string[];
    statuses?: PointStatus[];
    dateFrom?: Date;
    dateTo?: Date;
  };
  watermark?: boolean;
}

export const sourceTypeLabels: Record<SourceType, string> = {
  [SourceType.GIS]: 'GIS点位',
  [SourceType.RESIDENT]: '居民反馈',
  [SourceType.INSPECTION]: '巡检照片',
  [SourceType.STREET]: '街道备注',
};

export const pointStatusLabels: Record<PointStatus, string> = {
  [PointStatus.PENDING]: '待处理',
  [PointStatus.CONFIRMED]: '已确认',
  [PointStatus.CONFLICT]: '有冲突',
  [PointStatus.MERGED]: '已归并',
};

export const actionTypeLabels: Record<ActionType, string> = {
  import: '导入',
  merge: '归并',
  split: '拆分',
  confirm: '确认',
  reject: '驳回',
  export: '导出',
  update: '更新',
};

export const exportColumnOptions = [
  { value: 'canonicalName', label: '标准名称' },
  { value: 'address', label: '地址' },
  { value: 'street', label: '所属街道' },
  { value: 'lat', label: '纬度' },
  { value: 'lng', label: '经度' },
  { value: 'status', label: '状态' },
  { value: 'sourceCount', label: '来源数量' },
  { value: 'sourceTypes', label: '来源类型' },
  { value: 'mergeReason', label: '归并依据' },
  { value: 'createdAt', label: '创建时间' },
  { value: 'updatedAt', label: '更新时间' },
];

export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  nameSimilarityThreshold: 0.7,
  distanceThreshold: 50,
  autoMergeConfidence: 0.9,
};
