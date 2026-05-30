export type TableStatus = 'idle' | 'ordered' | 'serving' | 'eating' | 'needs_clearing' | 'clearing'

export type RiskCategory = 'route_cross' | 'delivery_timeout' | 'missed_cleaning'

export type RecordStatus = 'processed' | 'pending' | 'returned'

export type DecisionType = 'path_planning' | 'task_priority' | 'time_pressure'

export type TaskType = 'deliver' | 'clear'

export type WaiterState = 'idle' | 'moving_to_kitchen' | 'picking_up' | 'delivering' | 'moving_to_table_clear' | 'clearing' | 'returning'

export interface Position {
  x: number
  z: number
}

export interface Table {
  id: string
  position: Position
  status: TableStatus
  orderTime: number | null
  finishTime: number | null
  cleanDeadline: number | null
  seatCount: number
}

export interface Waiter {
  id: string
  position: Position
  state: WaiterState
  currentTask: Task | null
  path: Position[]
  pathIndex: number
  carryingFood: boolean
  carryingDishes: boolean
}

export interface Task {
  id: string
  type: TaskType
  tableId: string
  waiterId: string | null
  priority: number
  createdAt: number
  deadline: number
  completed: boolean
}

export interface RiskRecord {
  id: string
  category: RiskCategory
  status: RecordStatus
  description: string
  explanation: string
  decisionType: DecisionType
  timestamp: number
  snapshotId: string
  tableId?: string
  waiterId?: string
  severity: number
  returnReason?: string
}

export interface DecisionLog {
  id: string
  decisionType: DecisionType
  reason: string
  consequence: string
  timestamp: number
  taskId: string
  waiterId: string
}

export interface GameSnapshot {
  id: string
  timestamp: number
  tables: Table[]
  waiters: Waiter[]
  tasks: Task[]
  event: string
}

export interface GameResult {
  id: string
  startTime: number
  endTime: number
  score: number
  routeCrossPenalty: number
  timeoutPenalty: number
  missedCleanPenalty: number
  totalRisks: number
  decisionsCount: number
}

export const DELIVERY_TIMEOUT_MS = 30000
export const CLEAN_DEADLINE_MS = 20000
export const EATING_DURATION_MS = 8000
export const GAME_DURATION_MS = 180000
export const WAITER_SPEED = 0.06

export const RISK_CATEGORY_LABELS: Record<RiskCategory, string> = {
  route_cross: '路线交叉',
  delivery_timeout: '出餐超时',
  missed_cleaning: '清洁漏做',
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  processed: '已处理',
  pending: '待确认',
  returned: '退回补材料',
}

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  path_planning: '路径规划',
  task_priority: '任务优先级',
  time_pressure: '时间压力',
}

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  idle: '空闲',
  ordered: '已下单',
  serving: '出餐中',
  eating: '用餐中',
  needs_clearing: '待收台',
  clearing: '收台中',
}
