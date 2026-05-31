export interface FeatureSpec {
  id: string
  featureName: string
  trainingSpec: string
  onlineSpec: string
  isConsistent: boolean | null
  inconsistentReason: string | null
  judgmentBasis: string | null
  source: "import" | "manual" | "correction"
  version: number
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  operationType: "import" | "correction" | "rollback" | "filter_export" | "leak_detected"
  operator: string
  targetFeatureId: string | null
  targetFeatureName: string | null
  beforeValue: string | null
  afterValue: string | null
  reason: string | null
  filterSnapshot: string | null
  createdAt: string
}

export interface LeakAlert {
  id: string
  featureName: string
  source: "evaluation_table" | "online_feedback"
  description: string
  nextStep: string
  responsiblePerson: string
  isResolved: boolean
  detectedAt: string
  resolvedAt: string | null
}

export interface EvaluationReport {
  generatedAt: string
  filterConditions: Record<string, unknown>
  totalFeatures: number
  consistentCount: number
  inconsistentCount: number
  pendingCount: number
  leakAlertCount: number
  conclusions: EvaluationConclusion[]
}

export interface EvaluationConclusion {
  featureName: string
  conclusion: string
  reason: string
  nextStep: string
  severity: "info" | "warning" | "critical"
}

export interface FilterState {
  featureName: string
  status: "all" | "consistent" | "inconsistent" | "pending"
  dateFrom: string | null
  dateTo: string | null
}
