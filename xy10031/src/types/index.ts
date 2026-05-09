export interface User {
  id: string
  username: string
  name: string
  role: 'ADMIN' | 'CHECKER'
  createdAt: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category?: string
  unit: string
  description?: string
  createdAt: string
  updatedAt: string
  inventory?: Inventory
}

export interface Inventory {
  id: string
  productId: string
  quantity: number
  minQuantity: number
  location?: string
  createdAt: string
  updatedAt: string
}

export interface InventoryTask {
  id: string
  name: string
  description?: string
  status: TaskStatus
  assigneeId?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  assignee?: User
  _count?: { records: number }
}

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SUCCESS' | 'FAILED'

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG'

export interface IpcResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

export interface TaskStatistics {
  total: number
  matched: number
  positiveDiff: number
  negativeDiff: number
  totalDifference: number
}

export interface SyncStats {
  pending: number
  syncing: number
  success: number
  failed: number
}
