export type BatchStatus = "processed" | "pending" | "rejected"

export type ConflictType = "label_mismatch" | "outlier_occlusion" | "parameter_loss" | "schema_mismatch"

export type OperationType =
  | "label_change"
  | "feature_toggle"
  | "threshold_adjust"
  | "status_change"
  | "data_merge"
  | "rollback"

export type AxisMapping = "x" | "y" | "z" | null

export interface Dataset {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Sample {
  id: string
  datasetId: string
  index: number
  projectedX: number
  projectedY: number
  projectedZ: number
  targetX: number
  targetY: number
  targetZ: number
  isOutlier: boolean
  outlierScore: number
}

export interface FeatureColumn {
  id: string
  datasetId: string
  name: string
  dataType: "numeric" | "categorical"
  selected: boolean
  axisMapping: AxisMapping
  order: number
  varianceRatio?: number
}

export interface LabelColumn {
  id: string
  datasetId: string
  name: string
  isPrimary: boolean
}

export interface LabelAssignment {
  sampleId: string
  columnId: string
  clusterId: number
  manuallyModified: boolean
}

export interface DataBatch {
  id: string
  datasetId: string
  fileName: string
  status: BatchStatus
  loadedAt: string
  rejectReason?: string
}

export interface ConflictReport {
  id: string
  batchId: string
  conflictType: ConflictType
  affectedSampleIds: string[]
  affectedColumns: string[]
  detail: string
  resolved: boolean
}

export interface HistoryEntry {
  id: string
  timestamp: string
  operationType: OperationType
  targetType: string
  targetId: string
  beforeValue: string
  afterValue: string
  operator: string
}

export interface RawDataFile {
  headers: string[]
  rows: Record<string, string | number | null>[]
}

export const CLUSTER_PALETTE = [
  "#00f5d4",
  "#f5a623",
  "#e84393",
  "#6c5ce7",
  "#00b894",
  "#fd79a8",
  "#0984e3",
  "#fdcb6e",
  "#e17055",
  "#00cec9",
]

export function getClusterColor(clusterId: number): string {
  return CLUSTER_PALETTE[clusterId % CLUSTER_PALETTE.length]
}
