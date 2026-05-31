export interface PracticeRecord {
  id: string
  studentName: string
  studentId: string
  partId: string
  scriptId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  score: number
  practiceDate: string
  operator: string
  createdAt: string
  updatedAt: string
  remark?: string
}

export interface Part {
  id: string
  name: string
  type: string
  quantity: number
  specification: string
  supplier: string
  createdAt: string
}

export interface Script {
  id: string
  title: string
  version: string
  content: string
  videoUrl?: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  action: 'create' | 'update' | 'delete' | 'import' | 'export' | 'batch'
  operator: string
  targetType: 'record' | 'part' | 'script' | 'batch'
  targetId: string
  beforeData?: string
  afterData?: string
  createdAt: string
}

export interface BatchTask {
  id: string
  type: 'import' | 'update' | 'delete'
  status: 'pending' | 'running' | 'completed' | 'failed'
  total: number
  success: number
  failed: number
  operator: string
  createdAt: string
  errorMessage?: string
}

export interface RecordFilters {
  studentName?: string
  status?: string
  startDate?: string
  endDate?: string
  partId?: string
}

export interface TableState {
  current: number
  pageSize: number
  scrollTop: number
  filters: RecordFilters
  sortedInfo?: {
    field: string
    order: 'ascend' | 'descend'
  }
}
