export interface Confirmation {
  id: string
  recordId: string
  confirmedBy: string
  confirmedAt: string
  note: string
  type: 'insurance_verified' | 'lighting_checked' | 'exhibition_confirmed' | 'manual_review'
}

export interface EvidenceChainEntry {
  id: string
  recordId: string
  type: 'insurance_change' | 'confirmation' | 'lighting_update' | 'exhibition_update' | 'correction' | 'status_change'
  referenceId: string
  referenceType: 'insurance' | 'lighting' | 'exhibition' | 'confirmation'
  description: string
  timestamp: string
  operator: string
}

export interface CorrectionEntry {
  id: string
  recordId: string
  field: string
  oldValue: string
  newValue: string
  reason: string
  reverted: boolean
  revertedAt: string | null
  revertedBy: string | null
  timestamp: string
  operator: string
}

export interface RestorationRecord {
  id: string
  artifactName: string
  artifactId: string
  restorer: string
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  description: string
  insurancePolicyId: string | null
  exhibitionId: string | null
  lightingRecordId: string | null
  confirmations: Confirmation[]
  evidenceChain: EvidenceChainEntry[]
  correctionHistory: CorrectionEntry[]
  createdAt: string
  updatedAt: string
}

export interface PolicyChange {
  id: string
  policyId: string
  field: string
  oldValue: string
  newValue: string
  reason: string
  timestamp: string
  operator: string
  affectedRecordIds: string[]
}

export interface InsurancePolicy {
  id: string
  policyNumber: string
  artifactId: string
  coverage: string
  validFrom: string
  validTo: string
  status: 'active' | 'expired' | 'pending' | 'cancelled'
  changeHistory: PolicyChange[]
  linkedRecordIds: string[]
}

export interface ExhibitionItem {
  id: string
  artifactId: string
  lightingRecordId: string | null
  position: string
  notes: string
  isDuplicate: boolean
}

export interface ExhibitionChecklist {
  id: string
  exhibitionName: string
  startDate: string
  endDate: string
  items: ExhibitionItem[]
}

export interface LightingRecord {
  id: string
  artifactId: string
  lightType: string
  intensity: number
  angle: number
  notes: string
  createdAt: string
}

export interface ImportConflict {
  localId: string
  importedId: string
  conflictType: 'duplicate' | 'field_mismatch'
  resolution: 'skip' | 'overwrite' | 'keep_both' | null
  fields: string[]
}

export interface ImportResult {
  id: string
  type: 'insurance' | 'record' | 'exhibition'
  totalCount: number
  successCount: number
  skippedCount: number
  errorCount: number
  conflicts: ImportConflict[]
  timestamp: string
}

export interface FilterState {
  status: string
  insuranceStatus: 'all' | 'linked' | 'missing'
  lightingStatus: 'all' | 'linked' | 'missing'
  exhibitionStatus: 'all' | 'linked' | 'missing'
  dateFrom: string
  dateTo: string
  search: string
}
