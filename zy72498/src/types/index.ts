export interface JunctionPhoto {
  id: string;
  fileName: string;
  uploadTime: string;
  junctionName: string;
  communityName: string;
  photoTime: string;
  hasCrosswalk: boolean;
  hasTrafficLight: boolean;
  note?: string;
  importBatch: string;
  thumbnailUrl?: string;
}

export interface BusCardRecord {
  id: string;
  communityName: string;
  timeSlot: string;
  cardCount: number;
  recordDate: string;
  importBatch: string;
  isSupplementary: boolean;
  source?: string;
}

export interface CommunityNameMap {
  id: string;
  oldName: string;
  newName: string;
  status: 'pending' | 'confirmed' | 'rejected';
  source: 'auto-detect' | 'manual';
  reviewedBy?: string;
  reviewedAt?: string;
  similarity?: number;
}

export type ConflictType = 'photo-bus-mismatch' | 'community-name-ambiguity' | 'data-inconsistency';
export type ConflictStatus = 'pending' | 'confirmed' | 'rejected';
export type ConflictSeverity = 'warning' | 'error';

export interface ConflictRecord {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  description: string;
  evidenceA: { source: string; data: Record<string, unknown> };
  evidenceB: { source: string; data: Record<string, unknown> };
  status: ConflictStatus;
  handledBy?: string;
  handledAt?: string;
  handlerNote?: string;
  relatedCommunity?: string;
}

export interface SummaryVersion {
  id: string;
  version: number;
  generatedAt: string;
  generatedBy: string;
  content: string;
  stats: {
    totalCommunities: number;
    totalPhotos: number;
    totalBusRecords: number;
    conflictsResolved: number;
    nameMapsConfirmed: number;
  };
  isExported: boolean;
}

export interface OperationLog {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  before?: unknown;
  after?: unknown;
}

export interface SelfCheckReport {
  id: string;
  runTime: string;
  items: {
    duplicateImport: { passed: boolean; issues: Array<{ batch: string; count: number; description: string }> };
    communityName: { passed: boolean; issues: Array<{ oldName: string; newName: string; similarity: number; description: string }> };
    recalculate: { passed: boolean; issues: Array<{ field: string; oldValue: number; newValue: number; description: string }> };
    exportConsistency: { passed: boolean; issues: Array<{ type: string; description: string }> };
  };
  overallPassed: boolean;
}

export type WorkflowStep = 1 | 2 | 3;

export interface AppState {
  photos: JunctionPhoto[];
  busRecords: BusCardRecord[];
  nameMaps: CommunityNameMap[];
  conflicts: ConflictRecord[];
  summaries: SummaryVersion[];
  logs: OperationLog[];
  selfCheckReports: SelfCheckReport[];
  currentStep: WorkflowStep;
  currentBatch: string;
  currentUser: string;
}
