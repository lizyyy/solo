export type CableStatus = 'confirmed' | 'pending' | 'manual';

export type SourceType = 'inspection_photo' | 'walkthrough' | 'manual';

export type OperationType = 'create' | 'update' | 'delete' | 'rollback' | 'import';

export type ConflictType = 'duplicate' | 'coordinate_flipped' | 'invalid_data';

export type SuggestedAction = 'keep' | 'overwrite' | 'merge' | 'skip';

export interface Point {
  x: number;
  y: number;
}

export interface CableRecord {
  id: string;
  cableNo: string;
  room: string;
  cabinet: string;
  startPoint: Point;
  endPoint: Point;
  cableType: string;
  status: CableStatus;
  sourceId: string;
  ownerId: string;
  remark: string;
  createdAt: string;
  updatedAt: string;
  coordinatesFlipped: boolean;
  isDuplicate?: boolean;
}

export interface DataSource {
  id: string;
  type: SourceType;
  name: string;
  uploader: string;
  uploadDate: string;
  description: string;
}

export interface ResponsiblePerson {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface VersionHistory {
  id: string;
  recordId: string;
  version: number;
  snapshot: CableRecord;
  operator: string;
  operation: OperationType;
  reason: string;
  createdAt: string;
}

export interface OperationLog {
  id: string;
  recordId: string;
  action: string;
  operator: string;
  detail: string;
  createdAt: string;
}

export interface ImportConflict {
  rowIndex: number;
  incomingData: Partial<CableRecord>;
  existingRecord?: CableRecord;
  conflictType: ConflictType;
  sourceInfo?: DataSource;
  suggestedAction: SuggestedAction;
  humanMessage: string;
  nextStep: string;
  contactPerson?: ResponsiblePerson;
  resolved?: boolean;
  resolution?: SuggestedAction;
}

export interface FilterConditions {
  rooms: string[];
  cabinets: string[];
  statuses: CableStatus[];
  sourceTypes: SourceType[];
  dateRange: { start: string; end: string } | null;
  cableTypes: string[];
  searchText: string;
}

export interface ExportConfig {
  format: 'pdf' | 'excel';
  includeCaliber: boolean;
  groupByStatus: boolean;
  template: 'customer' | 'internal';
  title: string;
  remark: string;
}

export interface HumanMessage {
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  reason: string;
  nextSteps: {
    text: string;
    action?: string;
  }[];
  contact?: ResponsiblePerson;
}

export interface ParsedExcelRow {
  cableNo?: string;
  room?: string;
  cabinet?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  cableType?: string;
  remark?: string;
}

export const STATUS_LABELS: Record<CableStatus, string> = {
  confirmed: '已确认',
  pending: '待补',
  manual: '人工修改',
};

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  inspection_photo: '巡检照片',
  walkthrough: '讲解路线',
  manual: '人工录入',
};

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  rollback: '回滚',
  import: '导入',
};

export const CABLE_TYPES = ['光纤', '网线', '电源线', '接地线', '信号线', '同轴电缆'];
export const ROOMS = ['A机房', 'B机房', 'C机房', 'D机房'];
export const CABINETS = ['A01', 'A02', 'A03', 'A04', 'B01', 'B02', 'B03', 'B04', 'C01', 'C02'];
