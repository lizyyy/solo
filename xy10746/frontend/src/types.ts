export enum PluginVersionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  SECURITY_SCANNING = 'security_scanning',
  SECURITY_PASSED = 'security_passed',
  SECURITY_FAILED = 'security_failed',
  PENDING_REVIEW = 'pending_review',
  REVIEW_APPROVED = 'review_approved',
  REVIEW_REJECTED = 'review_rejected',
  PENDING_RECHECK = 'pending_recheck',
  PUBLISHED = 'published',
  UNPUBLISHED = 'unpublished',
  ARCHIVED = 'archived'
}

export enum ReviewResult {
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_REVISION = 'needs_revision'
}

export enum ApiResponseStatus {
  SUCCESS = 'success',
  PENDING_REVIEW = 'pending_review',
  BLOCKED = 'blocked',
  RETRYABLE = 'retryable'
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PluginVersion {
  id: string;
  pluginId: string;
  version: string;
  status: PluginVersionStatus;
  packageUrl: string;
  packageHash: string;
  permissionDeclarations: PermissionDeclaration[];
  retryCount: number;
  maxRetries: number;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
  unpublishedBy?: string;
  unpublishedAt?: string;
  unpublishedReason?: string;
  pluginName?: string;
  pluginAuthor?: string;
}

export interface PermissionDeclaration {
  id: string;
  name: string;
  description: string;
  scope: string;
  required: boolean;
  createdAt: string;
}

export interface SecurityScan {
  id: string;
  versionId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  findings: SecurityFinding[];
  startedAt: string;
  completedAt?: string;
  scannerVersion: string;
}

export interface SecurityFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: string;
  description: string;
  location?: string;
}

export interface ReviewOpinion {
  id: string;
  versionId: string;
  reviewerId: string;
  reviewerName: string;
  result: ReviewResult;
  comment: string;
  createdAt: string;
  correctionPath?: CorrectionPath;
}

export interface CorrectionPath {
  id: string;
  originalOpinionId: string;
  revisedComment: string;
  revisedBy: string;
  revisedAt: string;
  justification: string;
}

export interface TimelineEvent {
  id: string;
  versionId: string;
  type: string;
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AuditStatistics {
  totalVersions: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  published: number;
  unpublished: number;
  securityPassRate: number;
  avgReviewTimeHours: number;
}

export interface ApiResponse<T = any> {
  status: ApiResponseStatus;
  message: string;
  data?: T;
  retryAfter?: number;
}
