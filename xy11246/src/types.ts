export enum BookCondition {
  NEW = '全新',
  LIKE_NEW = '九成新',
  GOOD = '八成新',
  FAIR = '七成新',
  POOR = '六成新及以下'
}

export enum GradeLevel {
  GRADE_1 = '一年级',
  GRADE_2 = '二年级',
  GRADE_3 = '三年级',
  GRADE_4 = '四年级',
  GRADE_5 = '五年级',
  GRADE_6 = '六年级',
  GRADE_7 = '七年级',
  GRADE_8 = '八年级',
  GRADE_9 = '九年级',
  GRADE_10 = '高一',
  GRADE_11 = '高二',
  GRADE_12 = '高三',
  UNKNOWN = '未分级'
}

export enum Role {
  VOLUNTEER = '志愿者',
  ADMIN = '管理员',
  AUDITOR = '审计员'
}

export enum ProcessingStatus {
  ACCEPTED = '已通过',
  REJECTED = '已拒绝',
  DUPLICATE = '重复导入',
  PENDING = '待处理'
}

export interface AuditFields {
  operator: string;
  operatorRole: Role;
  operatedAt: Date;
}

export interface BookInput {
  isbn?: string;
  title: string;
  author?: string;
  publisher?: string;
  condition?: string;
  gradeLevel?: string;
  donor?: string;
  remark?: string;
}

export interface BookRecord {
  id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  publisher: string | null;
  condition: BookCondition;
  gradeLevel: GradeLevel;
  donor: string | null;
  remark: string | null;
  importBatchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportBatch {
  id: string;
  operator: string;
  operatorRole: Role;
  importedAt: Date;
  totalCount: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
}

export interface ProcessingResult {
  recordId?: string;
  input: BookInput;
  status: ProcessingStatus;
  reason: string;
  isDuplicate: boolean;
  audit: AuditFields;
  processedAt: Date;
}

export interface ShelfItem {
  bookId: string;
  isbn: string | null;
  title: string;
  author: string | null;
  condition: BookCondition;
  gradeLevel: GradeLevel;
  shelfNumber: string;
}

export interface ShelfList {
  id: string;
  generatedAt: Date;
  operator: string;
  operatorRole: Role;
  batchId?: string;
  items: ShelfItem[];
  totalCount: number;
}

export interface HistoryQuery {
  startDate?: Date;
  endDate?: Date;
  operator?: string;
  isbn?: string;
  status?: ProcessingStatus;
  page?: number;
  pageSize?: number;
}

export interface HistoryRecord {
  id: string;
  batchId: string;
  isbn: string | null;
  title: string;
  status: ProcessingStatus;
  reason: string;
  operator: string;
  operatorRole: Role;
  operatedAt: Date;
}
