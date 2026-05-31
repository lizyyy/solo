export type UserRole = 'curator' | 'assistant';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type DimensionUnit = 'cm' | 'mm' | 'm' | 'inch' | 'unknown';

export interface Artwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  width: number;
  height: number;
  depth?: number;
  unit: DimensionUnit;
  unitConfirmed: boolean;
  location: string;
  status: 'normal' | 'pending_confirmation' | 'replaced';
  replacedBy?: string;
  replacementNote?: string;
  manualChange: boolean;
  changeReason?: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface LightingRecord {
  id: string;
  exhibitionId: string;
  artworkId: string;
  luxLevel: number;
  colorTemperature: number;
  angle: number;
  notes: string;
  recordedBy: string;
  recordedAt: string;
  version: number;
  isOverridden: boolean;
  overrideReason?: string;
}

export interface CuratorNote {
  id: string;
  exhibitionId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  isSupplement: boolean;
  supplementReason?: string;
  previousVersionId?: string;
}

export type ChangeType = 
  | 'artwork_added' 
  | 'artwork_removed' 
  | 'artwork_modified'
  | 'dimension_unit_changed'
  | 'lighting_recorded'
  | 'lighting_overridden'
  | 'note_added'
  | 'note_updated'
  | 'artwork_replaced'
  | 'layout_finalized';

export interface ChangeLog {
  id: string;
  exhibitionId: string;
  changeType: ChangeType;
  entityId: string;
  entityType: 'artwork' | 'lighting' | 'note' | 'layout';
  oldValue?: string;
  newValue?: string;
  reason: string;
  operator: string;
  timestamp: string;
  requiresConfirmation: boolean;
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
}

export type FlashLoanStatus = 
  | 'draft'
  | 'pending_review'
  | 'material_only'
  | 'conclusion_changed'
  | 'needs_confirmation'
  | 'approved'
  | 'rejected';

export type LoanChangeType = 
  | 'material_supplement'
  | 'conclusion_revision'
  | 'both';

export interface AutoJudgment {
  judgmentType: 'material_only' | 'conclusion_changed' | 'needs_confirmation';
  reasons: string[];
  confidence: number;
  algorithmVersion: string;
  judgedAt: string;
}

export interface FlashLoanRequest {
  id: string;
  exhibitionId: string;
  requestNumber: string;
  title: string;
  description: string;
  changes: LoanItem[];
  submittedBy: string;
  submittedAt: string;
  status: FlashLoanStatus;
  changeType: LoanChangeType;
  autoJudgment?: AutoJudgment;
  manualOverride?: boolean;
  overrideReason?: string;
  overrideBy?: string;
  nextSteps: string[];
  curatorMessage: string;
  previousRequestId?: string;
  versionDiff?: VersionDifference[];
  updatedAt: string;
}

export interface LoanItem {
  id: string;
  artworkId: string;
  artworkTitle: string;
  changeDescription: string;
  isMaterialOnly: boolean;
  impactLevel: 'low' | 'medium' | 'high';
}

export interface VersionDifference {
  field: string;
  oldValue: string;
  newValue: string;
  changeType: 'note' | 'lighting' | 'artwork' | 'other';
  requiresAttention: boolean;
}

export type AnomalyType = 
  | 'lighting_overridden'
  | 'dimension_unit_error'
  | 'artwork_replaced_no_trace'
  | 'note_silently_overwritten'
  | 'unit_mismatch';

export interface Anomaly {
  id: string;
  exhibitionId: string;
  type: AnomalyType;
  description: string;
  entityId: string;
  entityType: 'artwork' | 'lighting' | 'note';
  severity: 'warning' | 'danger';
  confirmed: boolean;
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface Exhibition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  status: 'planning' | 'installation' | 'open' | 'closed';
  artworks: Artwork[];
  lightingRecords: LightingRecord[];
  curatorNotes: CuratorNote[];
  changeLogs: ChangeLog[];
  flashLoans: FlashLoanRequest[];
  anomalies: Anomaly[];
  layoutFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutList {
  exhibitionId: string;
  version: number;
  artworks: Array<{
    artworkId: string;
    title: string;
    artist: string;
    dimensions: string;
    location: string;
    sequence: number;
    status: string;
  }>;
  generatedAt: string;
  generatedBy: string;
  hasAnomalies: boolean;
  anomalyCount: number;
  pendingConfirmationCount: number;
}
