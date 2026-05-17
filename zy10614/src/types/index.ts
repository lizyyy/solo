export enum CandidateStatus {
  PENDING_MERGE = 'pending_merge',
  CONFLICT_REVIEW = 'conflict_review',
  MERGED = 'merged',
  KEEP_INDEPENDENT = 'keep_independent'
}

export enum SourceChannel {
  HEADHUNTER = 'headhunter',
  OFFICIAL_WEBSITE = 'official_website',
  INTERNAL_RECOMMENDATION = 'internal_recommendation',
  ZHAOPIN = 'zhaopin',
  LIEPIN = 'liepin',
  BOSS = 'boss',
  OTHER = 'other'
}

export enum MergeAction {
  MERGE = 'merge',
  KEEP_INDEPENDENT = 'keep_independent',
  WITHDRAW = 'withdraw'
}

export interface Candidate {
  id: string;
  name: string;
  phone: string;
  email: string;
  sourceChannel: SourceChannel;
  status: CandidateStatus;
  resumeUrl?: string;
  position?: string;
  createdAt: Date;
  updatedAt: Date;
  mergedIntoId?: string;
  conflictCandidateIds?: string[];
}

export interface ImportRecord {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  errors: ImportError[];
}

export interface ImportError {
  rowNumber: number;
  field: string;
  message: string;
  rawData: Record<string, any>;
}

export interface MergeHistory {
  id: string;
  candidateId: string;
  action: MergeAction;
  operator: string;
  remark?: string;
  createdAt: Date;
  targetCandidateId?: string;
}

export interface CreateCandidateRequest {
  name: string;
  phone: string;
  email: string;
  sourceChannel: SourceChannel;
  resumeUrl?: string;
  position?: string;
}

export interface UpdateCandidateRequest {
  name?: string;
  phone?: string;
  email?: string;
  sourceChannel?: SourceChannel;
  resumeUrl?: string;
  position?: string;
}

export interface ReviewRequest {
  candidateId: string;
  action: MergeAction;
  operator: string;
  remark?: string;
  targetCandidateId?: string;
}

export interface CandidateQuery {
  status?: CandidateStatus;
  sourceChannel?: SourceChannel;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ExportCandidate {
  候选人ID: string;
  姓名: string;
  手机号: string;
  邮箱: string;
  来源渠道: string;
  状态: string;
  应聘职位?: string;
  创建时间: string;
  更新时间: string;
  合并到候选人ID?: string;
  冲突候选人ID?: string;
}
