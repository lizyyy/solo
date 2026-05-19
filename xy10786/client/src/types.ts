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
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  syncedAt: string | null;
  externalId: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewRecord {
  id: string;
  contentId: string;
  action: ReviewAction;
  reviewer: string;
  reason: string;
  remark: string;
  createdAt: string;
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
  timestamp: string;
  details: any;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: ContentStatus;
  channels: ChannelType[];
}

export const StatusLabelMap: Record<ContentStatus, string> = {
  [ContentStatus.DRAFT]: '草稿',
  [ContentStatus.PENDING_REVIEW]: '待审核',
  [ContentStatus.APPROVED]: '已通过',
  [ContentStatus.SCHEDULED]: '已排期',
  [ContentStatus.PUBLISHING]: '发布中',
  [ContentStatus.PUBLISHED]: '已发布',
  [ContentStatus.SYNCING]: '同步中',
  [ContentStatus.SYNCED]: '已同步',
  [ContentStatus.NEEDS_REVIEW]: '需复核',
  [ContentStatus.BLOCKED]: '已拦截',
  [ContentStatus.RETRYABLE]: '可重试',
  [ContentStatus.FAILED]: '发布失败',
  [ContentStatus.WITHDRAWN]: '已撤回'
};

export const ChannelLabelMap: Record<ChannelType, string> = {
  [ChannelType.WEBSITE]: '官网',
  [ChannelType.WECHAT]: '微信公众号',
  [ChannelType.WEIBO]: '微博',
  [ChannelType.XIAOHONGSHU]: '小红书',
  [ChannelType.DOUYIN]: '抖音'
};

export const StatusColorMap: Record<ContentStatus, string> = {
  [ContentStatus.DRAFT]: 'default',
  [ContentStatus.PENDING_REVIEW]: 'orange',
  [ContentStatus.APPROVED]: 'green',
  [ContentStatus.SCHEDULED]: 'blue',
  [ContentStatus.PUBLISHING]: 'cyan',
  [ContentStatus.PUBLISHED]: 'green',
  [ContentStatus.SYNCING]: 'cyan',
  [ContentStatus.SYNCED]: 'green',
  [ContentStatus.NEEDS_REVIEW]: 'orange',
  [ContentStatus.BLOCKED]: 'red',
  [ContentStatus.RETRYABLE]: 'orange',
  [ContentStatus.FAILED]: 'red',
  [ContentStatus.WITHDRAWN]: 'default'
};
