export type PersonType = 'artist' | 'staff' | 'guest';
export type RecordStatus = 'pending' | 'confirmed' | 'issue';
export type QualityIssueType = 'empty' | 'duplicate' | 'boundary';
export type Severity = 'warning' | 'error' | 'info';

export interface RoomAllocation {
  id: string;
  tourName: string;
  hotelName: string;
  roomType: string;
  personName: string;
  personType: PersonType;
  checkInDate: string;
  checkOutDate: string;
  remarks: string;
  source: string;
  status: RecordStatus;
  manualTag?: string;
  createdAt: string;
  updatedAt: string;
  versionId: string;
}

export interface Version {
  id: string;
  versionName: string;
  versionNumber: number;
  sourceFile: string;
  operator: string;
  changeNote: string;
  createdAt: string;
  recordCount: number;
}

export interface ChangeLog {
  id: string;
  recordId: string;
  versionId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  changedAt: string;
}

export interface SourceTrace {
  id: string;
  recordId: string;
  fileName: string;
  importedAt: string;
  operator: string;
  rawData: string;
}

export interface DataQualityIssue {
  recordId: string;
  type: QualityIssueType;
  field?: string;
  message: string;
  severity: Severity;
}

export interface ConflictItem {
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  oldSource: string;
  newSource: string;
  suggestion: string;
}

export interface FilterState {
  tourName: string;
  hotelName: string;
  roomType: string;
  personType: string;
  status: string;
  searchText: string;
  qualityFilter: string;
}

export interface ImportSourceInfo {
  fileName: string;
  operator: string;
  changeNote: string;
}

export const PERSON_TYPE_LABELS: Record<PersonType, string> = {
  artist: '艺人',
  staff: '工作人员',
  guest: '嘉宾',
};

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  issue: '有问题',
};

export const QUALITY_TYPE_LABELS: Record<QualityIssueType, string> = {
  empty: '空值',
  duplicate: '重复项',
  boundary: '边界记录',
};
