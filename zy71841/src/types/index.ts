export type RecordSource = 'model_list' | 'inspection_photo' | 'manual_correction';
export type RecordStatus = 'normal' | 'late' | 'duplicate' | 'pending';

export interface Attachment {
  id: string;
  recordId: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  isLate: boolean;
}

export interface BaseRecord {
  id: string;
  source: RecordSource;
  status: RecordStatus;
  pendingReason?: string;
  modifiedBy: string;
  createdAt: string;
  updatedAt: string;
  attachments: Attachment[];
  content: {
    modelNumber?: string;
    vin?: string;
    carModel?: string;
    color?: string;
    position?: string;
    arrivalDate?: string;
    inspectionDate?: string;
    notes?: string;
    [key: string]: any;
  };
}

export interface HistoryEntry {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: any;
  newValue: any;
  modifiedBy: string;
  modifiedAt: string;
  reason: string;
}

export interface Exhibit {
  id: string;
  name: string;
  modelNumber: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutePoint {
  id: string;
  x: number;
  y: number;
  order: number;
}

export interface Route {
  id: string;
  name: string;
  points: RoutePoint[];
  version: number;
  isActive: boolean;
  createdAt: string;
  modifiedBy: string;
}

export interface Conflict {
  routePointId: string;
  exhibitId: string;
  exhibitName: string;
  distance: number;
}

export interface RecordFilter {
  status?: RecordStatus;
  source?: RecordSource;
  modifiedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface ImportResult {
  totalRecords: number;
  normalRecords: number;
  lateRecords: number;
  duplicateRecords: number;
  pendingRecords: number;
  records: BaseRecord[];
  warnings: string[];
}

export interface ParsedFile {
  name: string;
  type: string;
  content: any;
  isLate: boolean;
}

export const sourceLabels: Record<RecordSource, string> = {
  model_list: '模型清单',
  inspection_photo: '巡检照片',
  manual_correction: '人工更正',
};

export const statusLabels: Record<RecordStatus, string> = {
  normal: '正常',
  late: '晚到',
  duplicate: '重复',
  pending: '待处理',
};
