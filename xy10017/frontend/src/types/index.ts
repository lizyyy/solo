export interface User {
  id: string
  username: string
  role: 'admin' | 'operator' | 'viewer'
  status?: string
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface LoginResponse {
  token: string
  user: User
}

export type PushStatus = 'pending' | 'queued' | 'processing' | 'sent' | 'failed' | 'partially_failed' | 'cancelled'
export type PushType = 'broadcast' | 'targeted' | 'system'

export interface PushMessage {
  _id: string
  idempotencyKey: string
  title: string
  content: string
  pushType: PushType
  targetUsers: string[]
  priority: number
  scheduledAt: string | null
  status: PushStatus
  retryCount: number
  maxRetries: number
  streamMessageId?: string
  sentAt: string | null
  failedAt: string | null
  errorMessage: string | null
  totalRecipients: number
  deliveredCount: number
  failedCount: number
  createdBy: User | string
  version: number
  createdAt: string
  updatedAt: string
}

export type AuditAction = 
  | 'user_login' 
  | 'user_logout' 
  | 'push_created' 
  | 'push_updated' 
  | 'push_deleted' 
  | 'push_sent' 
  | 'push_failed' 
  | 'push_cancelled' 
  | 'push_retried' 
  | 'report_exported'

export type ResourceType = 'user' | 'push_message' | 'audit_log' | 'report'

export interface AuditLog {
  _id: string
  action: AuditAction
  resourceType: ResourceType
  resourceId?: string
  userId: string
  username: string
  ipAddress?: string
  userAgent?: string
  before?: any
  after?: any
  changes?: Array<{
    field: string
    before: any
    after: any
  }>
  status: 'success' | 'failed'
  errorMessage?: string
  description?: string
  createdAt: string
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  pagination?: {
    page: number
    limit: number
    total: number
    pages: number
  }
  timestamp: string
}

export interface Statistics {
  total: number
  today: number
  byStatus: Record<string, number>
  byType: Record<string, number>
}
