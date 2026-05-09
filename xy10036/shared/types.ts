export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user'
  createdAt: string
  updatedAt: string
}

export interface Device {
  id: string
  name: string
  code: string
  type: string
  model?: string
  serialNumber?: string
  status: DeviceStatus
  currentBorrowerId?: string
  currentBorrowerName?: string
  description?: string
  createdAt: string
  updatedAt: string
}

export type DeviceStatus = 'available' | 'borrowed' | 'maintenance' | 'retired'

export interface BorrowRecord {
  id: string
  deviceId: string
  deviceName: string
  deviceCode: string
  userId: string
  userName: string
  purpose: string
  borrowTime: string
  expectedReturnTime: string
  actualReturnTime?: string
  status: BorrowStatus
  notes?: string
  version: number
  createdAt: string
  updatedAt: string
}

export type BorrowStatus = 'pending' | 'borrowed' | 'returned' | 'overdue'

export interface AuditLog {
  id: string
  action: AuditAction
  entityType: EntityType
  entityId: string
  entityName?: string
  operatorId: string
  operatorName: string
  before?: Record<string, any>
  after?: Record<string, any>
  requestId: string
  ip?: string
  userAgent?: string
  createdAt: string
}

export type AuditAction = 'create' | 'update' | 'delete' | 'borrow' | 'return' | 'status_change'
export type EntityType = 'device' | 'borrow_record' | 'user'

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  requestId: string
  timestamp: string
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface BorrowRequest {
  deviceId: string
  purpose: string
  expectedReturnTime: string
  requestId: string
}

export interface ReturnRequest {
  borrowRecordId: string
  notes?: string
  requestId: string
}

export interface ReportFilters {
  startDate?: string
  endDate?: string
  deviceId?: string
  userId?: string
  status?: BorrowStatus
}
