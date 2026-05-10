export enum StatusType {
  OFFLINE = 'OFFLINE',
  ONLINE = 'ONLINE',
  SUSPENDED = 'SUSPENDED'
}

export enum OfflineReason {
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  ACTIVITY_END = 'ACTIVITY_END',
  COMPLIANCE = 'COMPLIANCE',
  MANUAL = 'MANUAL'
}

export enum SourceType {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL'
}

export enum TaskStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum ChannelName {
  MEITUAN = '美团',
  ELEME = '饿了么',
  DOUYIN = '抖音',
  WECHAT = '微信小程序'
}

export interface Channel {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
  createdAt: string;
}

export interface MenuItem {
  id: string;
  name: string;
  code: string;
  category: string;
  price: number;
  description: string;
  createdAt: string;
}

export interface MenuVersion {
  id: string;
  version: string;
  description: string;
  itemIds: string[];
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

export interface Inventory {
  id: string;
  storeId: string;
  itemId: string;
  quantity: number;
  minThreshold: number;
  updatedAt: string;
  updatedBy: string;
}

export interface ChannelStatus {
  id: string;
  storeId: string;
  itemId: string;
  channelId: string;
  status: StatusType;
  lastChangeReason: OfflineReason | null;
  lastChangeSource: SourceType;
  changedBy: string;
  changedAt: string;
}

export interface StatusHistory {
  id: string;
  storeId: string;
  itemId: string;
  channelId: string;
  previousStatus: StatusType | null;
  newStatus: StatusType;
  reason: OfflineReason | null;
  source: SourceType;
  operator: string;
  remark: string;
  timestamp: string;
  relatedTaskId: string | null;
}

export interface RecoveryTask {
  id: string;
  storeId: string;
  itemId: string;
  channelIds: string[];
  scheduledTime: string;
  status: TaskStatus;
  executedAt: string | null;
  createdBy: string;
  createdAt: string;
  reason: string;
}

export interface ReconciliationJob {
  id: string;
  executedAt: string;
  storeId: string | null;
  channelId: string | null;
  totalChecked: number;
  inconsistentCount: number;
  fixedCount: number;
  details: string;
  status: TaskStatus;
}

export interface AuditLog {
  id: string;
  operationType: string;
  targetType: string;
  targetId: string;
  operator: string;
  timestamp: string;
  details: string;
}

export interface BusinessResponse<T = unknown> {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  timestamp: string;
}

export interface HistoryQueryResult {
  records: StatusHistory[];
  summary: {
    total: number;
    autoChanges: number;
    manualChanges: number;
    onlineCount: number;
    offlineCount: number;
  };
}
