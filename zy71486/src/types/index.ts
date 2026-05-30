export interface NoiseRecord {
  id: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  decibel: number;
  complaintSource: string;
  description: string;
  batchId: string;
  isUpdate: boolean;
  isDuplicate: boolean;
  previousVersionId: string | null;
}

export interface Room {
  id: string;
  roomId: string;
  name: string;
  location: string;
  soundproofLevel: string;
  batchId: string;
}

export interface Course {
  id: string;
  roomId: string;
  courseName: string;
  teacher: string;
  weekday: string;
  startTime: string;
  endTime: string;
  batchId: string;
}

export type ConflictType = 'TIME_MISMATCH' | 'ROOM_NOT_FOUND' | 'DATA_INCONSISTENT';

export interface Conflict {
  id: string;
  type: ConflictType;
  noiseRecordId: string;
  description: string;
  resolution: string;
  isResolved: boolean;
  createdAt: string;
}

export type ProcessingStatusType = 'PENDING' | 'PROCESSING' | 'RESOLVED';

export interface StatusHistoryEntry {
  status: ProcessingStatusType;
  result: string;
  handler: string;
  updatedAt: string;
}

export interface ProcessingStatus {
  id: string;
  noiseRecordId: string;
  status: ProcessingStatusType;
  handler: string;
  result: string;
  previousResult: string | null;
  previousStatus: ProcessingStatusType | null;
  updatedAt: string;
  history: StatusHistoryEntry[];
}

export type ImportSourceType = 'NOISE' | 'ROOM' | 'COURSE';

export interface ImportBatch {
  id: string;
  sourceType: ImportSourceType;
  totalCount: number;
  newCount: number;
  updatedCount: number;
  duplicateCount: number;
  importedAt: string;
}

export const CONFLICT_LABELS: Record<ConflictType, string> = {
  TIME_MISMATCH: '时间错位',
  ROOM_NOT_FOUND: '房间编号错误',
  DATA_INCONSISTENT: '数据不一致',
};

export const STATUS_LABELS: Record<ProcessingStatusType, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  RESOLVED: '已处理',
};

export const WEEKDAY_LABELS: Record<string, string> = {
  '1': '周一',
  '2': '周二',
  '3': '周三',
  '4': '周四',
  '5': '周五',
  '6': '周六',
  '7': '周日',
};

export const DECIBEL_THRESHOLD = 70;
