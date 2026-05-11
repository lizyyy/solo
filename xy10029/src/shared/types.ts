export interface User {
  id: string
  username: string
  password: string
  displayName: string
  role: UserRole
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  USER = 'user'
}

export enum Permission {
  VIEW_DEVICES = 'view_devices',
  MANAGE_DEVICES = 'manage_devices',
  LEND_DEVICE = 'lend_device',
  RETURN_DEVICE = 'return_device',
  VIEW_HISTORY = 'view_history',
  VIEW_LOGS = 'view_logs',
  EXPORT_DATA = 'export_data',
  IMPORT_DATA = 'import_data',
  MANAGE_USERS = 'manage_users',
  BATCH_OPERATIONS = 'batch_operations',
  RESTORE_VERSION = 'restore_version',
  SYSTEM_SETTINGS = 'system_settings'
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.VIEW_DEVICES,
    Permission.MANAGE_DEVICES,
    Permission.LEND_DEVICE,
    Permission.RETURN_DEVICE,
    Permission.VIEW_HISTORY,
    Permission.VIEW_LOGS,
    Permission.EXPORT_DATA,
    Permission.IMPORT_DATA,
    Permission.MANAGE_USERS,
    Permission.BATCH_OPERATIONS,
    Permission.RESTORE_VERSION,
    Permission.SYSTEM_SETTINGS
  ],
  [UserRole.OPERATOR]: [
    Permission.VIEW_DEVICES,
    Permission.LEND_DEVICE,
    Permission.RETURN_DEVICE,
    Permission.VIEW_HISTORY,
    Permission.EXPORT_DATA,
    Permission.BATCH_OPERATIONS
  ],
  [UserRole.USER]: [
    Permission.VIEW_DEVICES,
    Permission.VIEW_HISTORY
  ]
}

export interface Device {
  id: string
  deviceCode: string
  name: string
  category: DeviceCategory
  model: string
  serialNumber: string
  status: DeviceStatus
  location: string
  description: string
  currentHolder: string | null
  currentHolderName: string | null
  borrowedAt: string | null
  expectedReturnAt: string | null
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export enum DeviceCategory {
  LAPTOP = 'laptop',
  PHONE = 'phone',
  TABLET = 'tablet',
  CAMERA = 'camera',
  AUDIO = 'audio',
  OTHER = 'other'
}

export enum DeviceStatus {
  AVAILABLE = 'available',
  BORROWED = 'borrowed',
  MAINTENANCE = 'maintenance',
  RESERVED = 'reserved',
  LOST = 'lost'
}

export const DeviceStatusTransitions: Record<DeviceStatus, DeviceStatus[]> = {
  [DeviceStatus.AVAILABLE]: [DeviceStatus.BORROWED, DeviceStatus.MAINTENANCE, DeviceStatus.RESERVED],
  [DeviceStatus.BORROWED]: [DeviceStatus.AVAILABLE, DeviceStatus.MAINTENANCE, DeviceStatus.LOST],
  [DeviceStatus.MAINTENANCE]: [DeviceStatus.AVAILABLE],
  [DeviceStatus.RESERVED]: [DeviceStatus.AVAILABLE, DeviceStatus.BORROWED],
  [DeviceStatus.LOST]: [DeviceStatus.AVAILABLE]
}

export interface BorrowRecord {
  id: string
  deviceId: string
  deviceCode: string
  borrowerId: string
  borrowerName: string
  operatorId: string
  operatorName: string
  borrowedAt: string
  expectedReturnAt: string | null
  returnedAt: string | null
  status: BorrowStatus
  purpose: string
  notes: string
  createdAt: string
  updatedAt: string
}

export enum BorrowStatus {
  ACTIVE = 'active',
  RETURNED = 'returned',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export interface DeviceHistory {
  id: string
  deviceId: string
  version: number
  snapshot: string
  changedAt: string
  changedBy: string
  changedByName: string
  changeType: ChangeType
  description: string
}

export enum ChangeType {
  CREATE = 'create',
  UPDATE = 'update',
  BORROW = 'borrow',
  RETURN = 'return',
  MAINTENANCE = 'maintenance',
  DELETE = 'delete',
  RESTORE = 'restore'
}

export interface SystemLog {
  id: string
  level: LogLevel
  module: string
  action: string
  userId: string | null
  userName: string | null
  details: string
  success: boolean
  errorMessage: string | null
  duration: number
  timestamp: string
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface FailedOperation {
  id: string
  operationType: string
  details: string
  errorMessage: string
  retryCount: number
  maxRetries: number
  status: RetryStatus
  lastAttemptAt: string
  nextRetryAt: string | null
  createdAt: string
}

export enum RetryStatus {
  PENDING = 'pending',
  RETRYING = 'retrying',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface BatchOperation {
  id: string
  operationType: string
  totalCount: number
  successCount: number
  failedCount: number
  status: BatchStatus
  startedAt: string
  completedAt: string | null
  results: BatchResult[]
  createdBy: string
  createdByName: string
}

export interface BatchResult {
  id: string
  batchOperationId: string
  itemId: string
  itemCode: string
  success: boolean
  errorMessage: string | null
  timestamp: string
}

export enum BatchStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  PARTIAL = 'partial',
  FAILED = 'failed'
}

export interface ExportOptions {
  format: 'excel' | 'csv'
  dataType: 'devices' | 'borrow_records' | 'users'
  filters?: Record<string, any>
  fields?: string[]
  includeHeaders?: boolean
}

export interface ImportResult {
  total: number
  success: number
  failed: number
  errors: ImportError[]
}

export interface ImportError {
  row: number
  message: string
  data: Record<string, any>
}

export interface PaginationParams {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface AuthContext {
  user: User
  permissions: Permission[]
}
