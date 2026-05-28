export type SourceType = "raw" | "result"

export type ConflictType = "isolated_node" | "strong_relation_split" | "capacity_overflow"

export type ConflictSeverity = "fatal" | "warning" | "info"

export type RecordStatus = "processed" | "pending" | "returned"

export type AlgorithmType = "louvain" | "label_propagation"

export interface GraphNode {
  id: string
  name: string
  projectLabels: string[]
  groupHint?: string
  sourceType: SourceType
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  weight: number
  sourceType: SourceType
}

export interface BlacklistEntry {
  nodeA: string
  nodeB: string
  reason: string
}

export interface CapacityConfig {
  minSize: number
  maxSize: number
}

export interface GroupResult {
  id: string
  name: string
  memberIds: string[]
  status: RecordStatus
}

export interface Conflict {
  id: string
  type: ConflictType
  severity: ConflictSeverity
  description: string
  affectedNodeIds: string[]
  affectedGroupIds: string[]
  suggestion: string
}

export interface HistoryRecord {
  id: string
  timestamp: string
  snapshot: string
  algorithm: AlgorithmType
  config: CapacityConfig
  groupCount: number
  conflictCount: number
}

export interface SamplePackage {
  nodes: GraphNode[]
  edges: GraphEdge[]
  projectLabels: Record<string, string[]>
  blacklist: BlacklistEntry[]
  capacityConfig: CapacityConfig
  previousGroups?: GroupResult[]
}

export interface AlgorithmConfig {
  algorithm: AlgorithmType
  resolution: number
  strongRelationThreshold: number
}

export const DEFAULT_CAPACITY: CapacityConfig = { minSize: 3, maxSize: 15 }
export const DEFAULT_ALGORITHM_CONFIG: AlgorithmConfig = {
  algorithm: "louvain",
  resolution: 1.0,
  strongRelationThreshold: 0.7,
}

export const GROUP_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#a855f7", "#22c55e", "#eab308",
]

export const SEVERITY_CONFIG: Record<ConflictSeverity, { label: string; color: string; bgColor: string; borderColor: string }> = {
  fatal: { label: "致命", color: "#ef4444", bgColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
  warning: { label: "警告", color: "#f59e0b", bgColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  info: { label: "提示", color: "#3b82f6", bgColor: "rgba(59,130,246,0.1)", borderColor: "rgba(59,130,246,0.3)" },
}

export const STATUS_CONFIG: Record<RecordStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  processed: { label: "已处理", color: "#10b981", bgColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" },
  pending: { label: "待确认", color: "#f59e0b", bgColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" },
  returned: { label: "需退回", color: "#ef4444", bgColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
}

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  isolated_node: "孤立节点",
  strong_relation_split: "强关系拆散",
  capacity_overflow: "容量越界",
}

export const ALGORITHM_TYPE_LABELS: Record<AlgorithmType, string> = {
  louvain: "Louvain 算法",
  label_propagation: "标签传播算法",
}
