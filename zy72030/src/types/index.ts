export type ActivityStatus = 'idle' | 'running' | 'paused' | 'settled'
export type RecordResult = 'success' | 'failure' | 'pending_review'
export type FailureReason = 'rule_misunderstanding' | 'operation_timeout' | 'boundary_score' | 'other_exception'
export type RecordSource = 'realtime' | 'group_supplement' | 'old_standard'

export interface Activity {
  id: string
  status: ActivityStatus
  createdAt: string
  pausedAt: string | null
  resumedAt: string | null
  settledAt: string | null
  totalElapsedSeconds: number
  pauseEvents: PauseEvent[]
}

export interface PauseEvent {
  type: 'pause' | 'resume'
  timestamp: string
}

export interface ExplorerRecord {
  id: string
  activityId: string
  sequenceNumber: number
  polyhedronType: string
  score: number
  timeCostSeconds: number
  result: RecordResult
  failureReason: FailureReason | null
  failureDetail: string | null
  source: RecordSource
  rawNote: string
  processedAt: string
}

export const POLYHEDRON_TYPES = [
  '正四面体',
  '正六面体',
  '正八面体',
  '正十二面体',
  '正二十面体',
  '截角四面体',
  '立方八面体',
  '截角八面体',
  '正三角旋转体',
  '正五角旋转体',
] as const

export const FAILURE_REASON_LABELS: Record<FailureReason, string> = {
  rule_misunderstanding: '规则没理解',
  operation_timeout: '操作慢了',
  boundary_score: '边界分数待确认',
  other_exception: '其他例外',
}

export const FAILURE_REASON_COLLEAGUE: Record<FailureReason, string> = {
  rule_misunderstanding: '这条是规则没搞清楚，不是手慢——建议下次先过一遍规则再动手',
  operation_timeout: '这条是操作超时了，规则理解没问题，就是动作慢了点',
  boundary_score: '这条得分卡在及格线，得人工再看一眼，别直接当通过或失败处理',
  other_exception: '这条情况比较特殊，标准分类没覆盖到，得单独说明',
}

export const SOURCE_LABELS: Record<RecordSource, string> = {
  realtime: '实时录入',
  group_supplement: '活动复盘群补录',
  old_standard: '旧口径',
}

export const RESULT_LABELS: Record<RecordResult, string> = {
  success: '成功',
  failure: '失败',
  pending_review: '待确认',
}
