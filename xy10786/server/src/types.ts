export enum ContentStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  PUBLISHING = 'publishing',
  PUBLISHED = 'published',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  NEEDS_REVIEW = 'needs_review',
  BLOCKED = 'blocked',
  RETRYABLE = 'retryable',
  FAILED = 'failed',
  WITHDRAWN = 'withdrawn'
}

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  WITHDRAW = 'withdraw',
  RESUBMIT = 'resubmit'
}

export enum ChannelType {
  WEBSITE = 'website',
  WECHAT = 'wechat',
  WEIBO = 'weibo',
  XIAOHONGSHU = 'xiaohongshu',
  DOUYIN = 'douyin'
}

export interface ContentItem {
  id: string;
  title: string;
  content: string;
  author: string;
  status: ContentStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  channels: ChannelSync[];
  reviewHistory: ReviewRecord[];
  version: number;
  idempotencyKey: string;
  retryCount: number;
  maxRetries: number;
}

export interface ChannelSync {
  id: string;
  contentId: string;
  channel: ChannelType;
  status: ContentStatus;
  syncedAt: Date | null;
  externalId: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewRecord {
  id: string;
  contentId: string;
  action: ReviewAction;
  reviewer: string;
  reason: string;
  remark: string;
  createdAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  code: ResponseCode;
  message: string;
  data?: T;
}

export enum ResponseCode {
  SUCCESS = 200,
  PENDING_REVIEW = 202,
  BLOCKED = 403,
  RETRYABLE = 409,
  NOT_FOUND = 404,
  VALIDATION_ERROR = 400,
  SERVER_ERROR = 500
}

export interface DashboardStats {
  total: number;
  draft: number;
  pendingReview: number;
  scheduled: number;
  published: number;
  failed: number;
  needsReview: number;
}

export interface TimelineItem {
  id: string;
  contentId: string;
  action: string;
  operator: string;
  timestamp: Date;
  details: any;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: ContentStatus;
  channels: ChannelType[];
}
