export type DataSourceType = "evaluation" | "online_feedback" | "config"

export type RecordStatus = "confirmed" | "pending" | "manual_modified" | "importing"

export interface Experiment {
  id: string
  name: string
  status: RecordStatus
  createdAt: string
}

export interface DataSource {
  id: string
  experimentId: string
  type: DataSourceType
  fileName: string
  importedAt: string
  importedBy: string
  rolledBack: boolean
}

export interface Metric {
  id: string
  experimentId: string
  name: string
  value: string
  source: DataSourceType
  caliberVersion: string
  caliberNote: string
  caliberChanged: boolean
  caliberChangeSource: DataSourceType | null
  caliberChangeNextStep: string | null
}

export interface Judgment {
  id: string
  metricId: string
  result: "pass" | "fail"
  reason: string
}

export interface EvaluationRecord {
  id: string
  experimentId: string
  status: RecordStatus
  caliberLabel: string
  modifiedBy: string | null
  modifiedAt: string | null
  modificationReason: string | null
  originalValue: string | null
  modifiedValue: string | null
  pendingItem: string | null
  responsiblePerson: string | null
}

export interface OperationLog {
  id: string
  experimentId: string
  action: "import" | "rollback" | "modify" | "confirm" | "reject"
  operator: string
  timestamp: string
  detail: string
}

export interface FilterState {
  source: DataSourceType | "all"
  status: RecordStatus | "all"
  timeRange: "7d" | "30d" | "all"
}

export const SOURCE_LABELS: Record<DataSourceType, string> = {
  evaluation: "评估表",
  online_feedback: "线上反馈",
  config: "配置文件",
}

export const STATUS_LABELS: Record<RecordStatus, string> = {
  confirmed: "已确认",
  pending: "待补",
  manual_modified: "人工改动",
  importing: "导入中",
}

export const ACTION_LABELS: Record<OperationLog["action"], string> = {
  import: "导入",
  rollback: "撤回",
  modify: "修正",
  confirm: "确认",
  reject: "驳回",
}
