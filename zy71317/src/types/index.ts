export interface ExperimentRecord {
  id: string
  magnetSpacing: number
  vehicleMass: number
  trackLength: number
  current: number
  disturbance: number
  stabilityReport?: string
  manualNote?: string
  rawFields?: Record<string, unknown>
  result: StabilityResult
  createdAt: string
}

export interface StabilityResult {
  status: "stable" | "critical" | "unstable"
  magneticForce: number
  gravityForce: number
  netForce: number
  ratio: number
  oscillationAmplitude: number
  anomalyType?: AnomalyType
  anomalyReason?: string
}

export type AnomalyType =
  | "current_exceed"
  | "negative_spacing"
  | "oscillation_diverge"

export type AnomalyFilterType = "all" | AnomalyType

export interface ValidationRule {
  field: keyof ExperimentRecord
  min?: number
  max?: number
  message: string
}

export interface ParamState {
  magnetSpacing: number
  vehicleMass: number
  trackLength: number
  current: number
  disturbance: number
}

export const SENSITIVE_FIELDS: (keyof ExperimentRecord)[] = [
  "stabilityReport",
]

export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  current_exceed: "电流越界",
  negative_spacing: "间距为负",
  oscillation_diverge: "振荡发散",
}

export const STATUS_LABELS: Record<StabilityResult["status"], string> = {
  stable: "稳定",
  critical: "临界",
  unstable: "不稳定",
}
