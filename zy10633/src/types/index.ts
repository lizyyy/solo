export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ROLLING_BACK = 'rolling_back',
  RESTORED = 'restored'
}

export enum RollbackStatus {
  SUCCESS = 'success',
  CONFLICT = 'conflict',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Article {
  id: string;
  title: string;
  content: string;
  status: ArticleStatus;
  businessObject: string;
  currentVersion: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  publishedBy?: string;
}

export interface ArticleVersion {
  id: string;
  articleId: string;
  version: number;
  title: string;
  content: string;
  createdBy: string;
  createdAt: Date;
  isPublished: boolean;
  publishedAt?: Date;
}

export interface RollbackRecord {
  id: string;
  articleId: string;
  articleTitle: string;
  fromVersion: number;
  toVersion: number;
  requestedBy: string;
  requestedAt: Date;
  reason: string;
  status: RollbackStatus;
  businessObject: string;
  executedAt?: Date;
  executedBy?: string;
  conflictDetails?: string;
  rejectReason?: string;
}

export interface RollbackFilter {
  startDate?: Date;
  endDate?: Date;
  status?: RollbackStatus;
  requestedBy?: string;
  businessObject?: string;
  articleId?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
