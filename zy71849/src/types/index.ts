export type FlipType = 'x-flip' | 'y-flip' | 'z-flip' | 'xy-flip' | 'xz-flip' | 'yz-flip' | 'xyz-flip' | 'none';

export type FlipSource = 'device-remark' | 'cad-point' | 'both';

export type SightStatus = 'confirmed' | 'pending' | 'manual-modified' | 'flip-detected';

export type InspectionCategory = 'confirmed' | 'pending-supplement' | 'manual-modified';

export type TraceSourceType = 'device-remark' | 'cad-point' | 'manual-input';

export interface Coordinate {
  x: number;
  y: number;
  z: number;
}

export interface ChangeDiff<T> {
  oldValue: T;
  newValue: T;
  changed: boolean;
}

export interface AuditInfo {
  modifier: string;
  modifiedAt: Date;
  changeReason?: string;
}

export interface Project {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  lastModifier: string;
}

export interface DeviceRemark {
  id: string;
  projectId: string;
  deviceCode: string;
  deviceName: string;
  content: string;
  coordinate: Coordinate;
  area: string;
  modifier: string;
  modifiedAt: Date;
  batchId: string;
}

export interface RemarkHistory {
  id: string;
  remarkId: string;
  oldContent: string;
  newContent: string;
  oldCoordinate: Coordinate;
  newCoordinate: Coordinate;
  modifier: string;
  modifiedAt: Date;
  changeReason: string;
}

export interface CADPoint {
  id: string;
  projectId: string;
  pointCode: string;
  pointName: string;
  x: number;
  y: number;
  z: number;
  source: string;
  batchId: string;
  importedAt: Date;
  importer: string;
  hasFlip?: boolean;
  flipType?: FlipType;
  flipSource?: FlipSource;
}

export interface FlipRecord {
  id: string;
  cadPointId: string;
  projectId: string;
  flipType: FlipType;
  source: FlipSource;
  assignee: string;
  assigneeRole: string;
  status: 'pending' | 'processing' | 'resolved';
  remark: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolver?: string;
}

export interface MaterialBatch {
  id: string;
  projectId: string;
  batchNo: string;
  checksum: string;
  importedAt: Date;
  importer: string;
  recordCount: number;
}

export interface SightRecord {
  id: string;
  projectId: string;
  batchId: string;
  deviceCode: string;
  pointCode: string;
  deviceName: string;
  pointName: string;
  conclusion: string;
  sightValue: number;
  status: SightStatus;
  isManualModified: boolean;
  traceSource: TraceSourceType;
  createdAt: Date;
  updatedAt: Date;
  manualModifier?: string;
  manualModifiedAt?: Date;
  manualReason?: string;
}

export interface TraceLink {
  id: string;
  recordId: string;
  sourceType: TraceSourceType;
  sourceId: string;
  sourceSnapshot: Record<string, unknown>;
  linkType: 'primary' | 'secondary' | 'manual';
}

export interface InspectionItem {
  id: string;
  recordId: string;
  projectId: string;
  category: InspectionCategory;
  handlingMethod: string;
  description: string;
  isConfirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: Date;
  nextStep: string;
  contactPerson: string;
  contactRole: string;
}

export interface TraceChain {
  record: SightRecord;
  links: {
    type: TraceSourceType;
    data: DeviceRemark | CADPoint | null;
    history?: RemarkHistory[];
  }[];
}

export const FLIP_TYPE_LABELS: Record<FlipType, string> = {
  'none': '无翻转',
  'x-flip': 'X轴翻转',
  'y-flip': 'Y轴翻转',
  'z-flip': 'Z轴翻转',
  'xy-flip': 'XY轴翻转',
  'xz-flip': 'XZ轴翻转',
  'yz-flip': 'YZ轴翻转',
  'xyz-flip': 'XYZ轴翻转',
};

export const FLIP_SOURCE_LABELS: Record<FlipSource, string> = {
  'device-remark': '设备备注',
  'cad-point': 'CAD点位',
  'both': '两者均有',
};

export const SIGHT_STATUS_LABELS: Record<SightStatus, string> = {
  'confirmed': '已确认',
  'pending': '待补充',
  'manual-modified': '人工改过',
  'flip-detected': '检测到翻转',
};

export const INSPECTION_CATEGORY_LABELS: Record<InspectionCategory, string> = {
  'confirmed': '已确认',
  'pending-supplement': '待补充',
  'manual-modified': '人工改过',
};

export const TRACE_SOURCE_LABELS: Record<TraceSourceType, string> = {
  'device-remark': '设备备注',
  'cad-point': 'CAD点位',
  'manual-input': '人工输入',
};

export const HANDLING_METHODS: Record<InspectionCategory, string> = {
  'confirmed': '数据校验通过，视线分析结果准确，可直接用于施工。',
  'pending-supplement': '数据存在缺失或异常，需补充完整后重新分析。请联系对应责任人补全数据。',
  'manual-modified': '数据经过人工调整，需再次核对原始材料。调整原因和依据已记录在案。',
};

export const CONTACT_ROLES: Record<FlipSource, { role: string; contact: string }> = {
  'device-remark': { role: '设备工程师', contact: '张工' },
  'cad-point': { role: 'CAD设计师', contact: '李工' },
  'both': { role: '项目经理', contact: '王经理' },
};
