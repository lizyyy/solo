export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

export enum TaskPriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
  EMERGENCY = 'emergency'
}

export interface Patient {
  id: string
  name: string
  idCard: string
  phone: string
  room: string
  bedNumber?: string
}

export interface Escort {
  id: string
  name: string
  phone: string
  employeeId: string
  status: 'available' | 'busy' | 'offline'
  currentTaskId?: string
}

export interface Task {
  id: string
  idempotencyKey: string
  patientId: string
  patient: Patient
  escortId?: string
  escort?: Escort
  status: TaskStatus
  priority: TaskPriority
  checkType: string
  checkLocation: string
  createdAt: number
  assignedAt?: number
  acceptedAt?: number
  startedAt?: number
  completedAt?: number
  cancelledAt?: number
  timeoutAt?: number
  remarks?: string
  transferHistory: TransferRecord[]
  waitTimeMinutes?: number
  serviceTimeMinutes?: number
}

export interface TransferRecord {
  id: string
  fromEscortId: string
  toEscortId: string
  transferredAt: number
  reason?: string
  operator: string
}

export interface IdempotencyRecord {
  key: string
  taskId: string
  operation: string
  createdAt: number
}

export interface Database {
  tasks: Task[]
  escorts: Escort[]
  idempotencyRecords: IdempotencyRecord[]
  lastUpdated: number
}

export interface TaskStats {
  totalTasks: number
  pendingTasks: number
  inProgressTasks: number
  completedTasks: number
  cancelledTasks: number
  timeoutTasks: number
  avgWaitTimeMinutes: number
  avgServiceTimeMinutes: number
  maxWaitTimeMinutes: number
  tasksByPriority: Record<TaskPriority, number>
  tasksByEscort: Record<string, { name: string; completed: number; inProgress: number }>
}

export type SensitiveFieldType = 'name' | 'idCard' | 'phone' | 'all'
