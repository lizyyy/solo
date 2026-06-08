export enum ShelterStatus {
  PROCESSED = 'processed',
  PENDING_VERIFY = 'pending_verify',
  ONSITE_CHECK = 'onsite_check'
}

export enum ConflictType {
  NONE = 'none',
  CAPACITY = 'capacity',
  COORDINATE = 'coordinate',
  TIME = 'time',
  MIXED = 'mixed'
}

export interface ShelterPoint {
  id: string;
  standardName: string;
  aliases: string[];
  longitude: number;
  latitude: number;
  reportedLongitude?: number;
  reportedLatitude?: number;
  designCapacity: number;
  reportedCount: number;
  status: ShelterStatus;
  sourceIds: string[];
  conflictType: ConflictType;
  capacityByTime: Record<string, number>;
  naturalLanguageResult: string;
  createdAt: string;
  updatedAt: string;
  oldDesignCapacity?: number;
  oldCapacityYear?: string;
  newDesignCapacity?: number;
  newCapacityYear?: string;
}

export interface FeedbackSource {
  id: string;
  rawText: string;
  reporter: string;
  reportTime: string;
  locationDescription: string;
  reportedPeople: number;
  timePeriod: string;
  shelterId: string;
  isDuplicate?: boolean;
}

export interface ProcessRecord {
  id: string;
  shelterId: string;
  operator: string;
  operateTime: string;
  action: string;
  oldStatus?: ShelterStatus;
  newStatus: ShelterStatus;
  remark: string;
  supplementMaterial?: string;
}

export interface ImportData {
  id: string;
  shelterId: string;
  source: string;
  officialCapacity: number;
  importTime: string;
  dataYear: string;
}

export interface CsvRawRow {
  _rowIndex: number;
  _raw: Record<string, string>;
}

export type ImportFieldKey =
  | 'standardName'
  | 'longitude'
  | 'latitude'
  | 'reportedLongitude'
  | 'reportedLatitude'
  | 'designCapacity'
  | 'reportedCount'
  | 'reporter'
  | 'reportTime'
  | 'timePeriod'
  | 'remark';

export interface ImportFieldDef {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  hints: string[];
}

export const importFieldDefs: ImportFieldDef[] = [
  { key: 'standardName', label: '点位名称', required: true, hints: ['点位名称', '名称', '地点', '避难所名称', '场所'] },
  { key: 'longitude', label: '经度', required: true, hints: ['经度', 'lng', 'longitude'] },
  { key: 'latitude', label: '纬度', required: true, hints: ['纬度', 'lat', 'latitude'] },
  { key: 'reportedLongitude', label: '反馈经度', required: false, hints: ['反馈经度', '居民经度'] },
  { key: 'reportedLatitude', label: '反馈纬度', required: false, hints: ['反馈纬度', '居民纬度'] },
  { key: 'designCapacity', label: '设计容量', required: true, hints: ['设计容量', '容量', '设计容量(人)', '容量(人)'] },
  { key: 'reportedCount', label: '反馈人数', required: true, hints: ['反馈人数', '人数', '反馈人数(人)', '人数(人)'] },
  { key: 'reporter', label: '反馈人', required: false, hints: ['反馈人', '报告人', '投诉人'] },
  { key: 'reportTime', label: '反馈时间', required: false, hints: ['反馈时间', '时间', '报告时间'] },
  { key: 'timePeriod', label: '时段', required: false, hints: ['时段', '时间段'] },
  { key: 'remark', label: '备注', required: false, hints: ['备注', '说明', '描述'] },
];

export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

export interface ImportPreviewItem {
  rawName: string;
  normalizedName: string;
  matchedShelterId: string | null;
  isDuplicate: boolean;
  duplicateReason: string;
  rowIndex: number;
  mappedValues: Partial<Record<ImportFieldKey, string>>;
}

export interface ImportSession {
  fileName: string;
  totalRows: number;
  headers: string[];
  rows: CsvRawRow[];
  columnMapping: ColumnMapping;
  previews: ImportPreviewItem[];
  importedAt: string;
}

export interface ConflictItem {
  id: string;
  shelterId: string;
  shelterName: string;
  type: ConflictType;
  severity: number;
  leftEvidence: string;
  rightEvidence: string;
  suggestion: string;
  resolved: boolean;
  resolution?: 'left' | 'right' | 'pending';
}

export const shelterStatusLabels: Record<ShelterStatus, string> = {
  [ShelterStatus.PROCESSED]: '已处理',
  [ShelterStatus.PENDING_VERIFY]: '待核实',
  [ShelterStatus.ONSITE_CHECK]: '需现场复看'
};

export const shelterStatusColors: Record<ShelterStatus, string> = {
  [ShelterStatus.PROCESSED]: 'bg-green-500',
  [ShelterStatus.PENDING_VERIFY]: 'bg-orange-500',
  [ShelterStatus.ONSITE_CHECK]: 'bg-red-500'
};

export const conflictTypeLabels: Record<ConflictType, string> = {
  [ConflictType.NONE]: '无冲突',
  [ConflictType.CAPACITY]: '容量冲突',
  [ConflictType.COORDINATE]: '坐标偏移',
  [ConflictType.TIME]: '时段冲突',
  [ConflictType.MIXED]: '多重冲突'
};

export const conflictTypeColors: Record<ConflictType, string> = {
  [ConflictType.NONE]: 'bg-gray-400',
  [ConflictType.CAPACITY]: 'bg-red-500',
  [ConflictType.COORDINATE]: 'bg-yellow-500',
  [ConflictType.TIME]: 'bg-blue-500',
  [ConflictType.MIXED]: 'bg-purple-500'
};
