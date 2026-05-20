export interface Task {
  id: number
  name: string
  description: string | null
  max_execution_time: number
  heartbeat_interval: number
  created_at: string
  updated_at: string | null
  is_active: boolean
}

export interface Lock {
  id: number
  task_id: number
  instance_id: string
  status: string
  acquired_at: string
  released_at: string | null
  expires_at: string
  last_heartbeat_at: string
  execution_window_start: string | null
  execution_window_end: string | null
  acquire_attempts: number
  failed_reason: string | null
}

export interface ExecutionLog {
  id: number
  task_id: number
  lock_id: number | null
  instance_id: string
  status: string
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  result: string | null
  error_message: string | null
  error_stack: string | null
  is_duplicate: boolean
  compensation_action: string | null
  compensation_note: string | null
}

export interface AbnormalQueue {
  id: number
  task_id: number
  execution_log_id: number | null
  lock_id: number | null
  instance_id: string
  abnormal_type: string
  description: string | null
  severity: string
  detected_at: string
  resolved_at: string | null
  is_resolved: boolean
  resolution_note: string | null
  task_name?: string
}

export interface TaskDetail extends Task {
  current_lock: Lock | null
  recent_logs: ExecutionLog[]
}

export interface Stats {
  active_locks: number
  total_tasks: number
  active_tasks: number
  today_executions: number
  today_duplicates: number
  unresolved_abnormals: number
}

export interface ApiResponse {
  success: boolean
  message: string
  data?: any
}
