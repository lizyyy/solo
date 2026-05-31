export type Source = "difficulty_label" | "review_record" | "question_bank"
export type ChangeType = "supplementary" | "conclusion_change"
export type RecordStatus = "pending" | "confirmed" | "closed"
export type UserRole = "teacher" | "assistant" | "lead"

export interface GradingRecord {
  id: string
  questionNo: string
  description: string
  source: Source
  changeType: ChangeType
  status: RecordStatus
  difficulty: string
  originalAnswer: string
  standardAnswer: string
  equivalentAnswerIssue: boolean
  equivalentAnswers: string[]
  pendingReason: string
  reviewConclusion: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface AuditEntry {
  id: string
  recordId: string
  operator: string
  role: UserRole
  action: string
  changeType: ChangeType
  detail: string
  timestamp: string
}

export interface CurrentUser {
  name: string
  role: UserRole
}

export const SOURCE_LABELS: Record<Source, string> = {
  difficulty_label: "难度标签",
  review_record: "讲评记录",
  question_bank: "题库表",
}

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  supplementary: "补材料",
  conclusion_change: "改结论",
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  pending: "待处理",
  confirmed: "已确认",
  closed: "已关闭",
}

export const ROLE_LABELS: Record<UserRole, string> = {
  teacher: "教师",
  assistant: "助教",
  lead: "教研组长",
}
