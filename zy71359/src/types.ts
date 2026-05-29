export type WorkStatus = 'pending' | 'queued' | 'firing' | 'completed' | 'rescheduled' | 'cancelled'
export type BatchStatus = 'open' | 'locked' | 'firing' | 'completed'

export interface Student {
  id: string
  name: string
  phone: string
  notes: string
  created_at: string
  work_count?: number
}

export interface Glaze {
  id: string
  name: string
  firing_temp: number
  color: string
  notes: string
}

export interface GlazeConflict {
  id: string
  glaze_a_id: string
  glaze_b_id: string
  glaze_a_name?: string
  glaze_b_name?: string
  reason: string
}

export interface Work {
  id: string
  name: string
  student_id: string
  student_name?: string
  glaze_ids: string[]
  glaze_names?: string[]
  width: number
  height: number
  depth: number
  status: WorkStatus
  created_at: string
  updated_at: string
}

export interface Batch {
  id: string
  name: string
  kiln_name: string
  max_width: number
  max_height: number
  max_depth: number
  status: BatchStatus
  fired_at: string | null
  completed_at: string | null
  created_at: string
  work_count?: number
  conflict_count?: number
}

export interface QueueEntry {
  id: string
  batch_id: string
  work_id: string
  work_name?: string
  student_name?: string
  glaze_names?: string[]
  width?: number
  height?: number
  depth?: number
  position: number
  queued_at: string
}

export interface Conflict {
  type: 'glaze_conflict' | 'size_exceeded'
  message: string
  details: Record<string, string>
}

export interface RescheduleLog {
  id: string
  work_id: string
  work_name?: string
  from_batch_id: string
  from_batch_name?: string
  to_batch_id: string | null
  to_batch_name?: string | null
  reason: string
  operated_by: string
  created_at: string
}

export interface FiringReport {
  id: string
  batch_id: string
  batch_name?: string
  summary: string
  work_details: WorkReportItem[]
  conflict_resolutions: ConflictResolution[]
  generated_at: string
}

export interface WorkReportItem {
  work_id: string
  work_name: string
  student_name: string
  glaze_names: string[]
  dimensions: string
  position: number
  status: string
}

export interface ConflictResolution {
  type: string
  description: string
  resolution: string
}

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  pending: '待排',
  queued: '已排',
  firing: '烧制中',
  completed: '已完成',
  rescheduled: '已改期',
  cancelled: '已取消',
}

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  open: '开放',
  locked: '已锁定',
  firing: '烧制中',
  completed: '已完成',
}
