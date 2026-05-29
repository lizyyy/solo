export type RecordStatus = 'draft' | 'pending' | 'verified' | 'listed' | 'archived';

export type ConditionGrade = 'M' | 'NM' | 'EX' | 'VG+' | 'VG' | 'G' | 'F' | 'P';

export type ExceptionType = 'missing_field' | 'duplicate' | 'state_invalid' | 'price_anomaly';

export interface InventoryRecord {
  id: string;
  catalogNumber: string;
  albumName: string;
  artist: string;
  pressYear: string;
  condition: ConditionGrade;
  consignor: string;
  price: number;
  shelfLocation: string;
  verificationReport: string;
  status: RecordStatus;
  versionTag: string;
  albumGroupId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConditionHistory {
  id: string;
  recordId: string;
  fromCondition: ConditionGrade;
  toCondition: ConditionGrade;
  reason: string;
  operator: string;
  timestamp: string;
}

export interface PriceHistory {
  id: string;
  recordId: string;
  fromPrice: number;
  toPrice: number;
  reason: string;
  operator: string;
  timestamp: string;
}

export interface Exception {
  id: string;
  recordId: string;
  type: ExceptionType;
  field?: string;
  message: string;
  resolved: boolean;
  timestamp: string;
}

export interface AlbumGroup {
  id: string;
  albumName: string;
  artist: string;
  recordIds: string[];
}

export interface RecordFormData {
  catalogNumber: string;
  albumName: string;
  artist: string;
  pressYear: string;
  condition: ConditionGrade;
  consignor: string;
  price: number;
  shelfLocation: string;
  verificationReport: string;
}

export interface FilterCriteria {
  searchText: string;
  status: RecordStatus[];
  condition: ConditionGrade[];
  consignor: string;
  minPrice: number | null;
  maxPrice: number | null;
  albumGroupId: string | null;
  hasExceptions: boolean | null;
}

export const REQUIRED_FIELDS: (keyof RecordFormData)[] = [
  'catalogNumber',
  'albumName',
  'artist',
  'pressYear',
  'condition',
  'consignor',
  'price',
  'shelfLocation',
  'verificationReport',
];

export const CONDITION_GRADES: { value: ConditionGrade; label: string }[] = [
  { value: 'M', label: 'M (全新)' },
  { value: 'NM', label: 'NM (近新)' },
  { value: 'EX', label: 'EX (优秀)' },
  { value: 'VG+', label: 'VG+ (很好)' },
  { value: 'VG', label: 'VG (好)' },
  { value: 'G', label: 'G (一般)' },
  { value: 'F', label: 'F (一般)' },
  { value: 'P', label: 'P (差)' },
];

export const STATUS_LABELS: Record<RecordStatus, string> = {
  draft: '草稿',
  pending: '待核对',
  verified: '已核对',
  listed: '已上架',
  archived: '已归档',
};

export const STATE_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  draft: ['pending'],
  pending: ['verified', 'archived'],
  verified: ['listed', 'archived'],
  listed: [],
  archived: [],
};

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  missing_field: '字段缺失',
  duplicate: '重复版号',
  state_invalid: '状态异常',
  price_anomaly: '价格异常',
};
