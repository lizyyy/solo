export type ItemStatus = 'pending' | 'confirmed' | 'reverted' | 'awaiting_patch';

export type SourceType = 'meeting' | 'manual' | 'supplement' | 'combined';

export type OffsetRiskLevel = 'none' | 'low' | 'high';

export type CreatedFrom = 'import' | 'quickstart';

export interface TimelineNode {
  id: string;
  type: 'origin' | 'manual_change' | 'supplement' | 'confirm' | 'revert' | 'awaiting';
  title: string;
  content: string;
  operator?: string;
  timestamp: string;
}

export interface DiffSegment {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

export interface DiffResult {
  segments: DiffSegment[];
  addedCount: number;
  removedCount: number;
}

export interface SummaryStats {
  total: number;
  confirmed: number;
  awaitingPatch: number;
  reverted: number;
  pending: number;
}

export interface DisclosureItem {
  id: string;
  sourceType: SourceType;
  title: string;
  content: string;
  originalContent: string;
  manualChangeContent?: string;
  supplementContent?: string;
  status: ItemStatus;
  fireZone: string;
  responsiblePerson: string;
  contactPhone: string;
  coordinateOffset: number;
  offsetRiskLevel: OffsetRiskLevel;
  blockerReason?: string;
  nextContact?: string;
  nextContactRole?: string;
  nextContactPhone?: string;
  revertReason?: string;
  confirmRemark?: string;
  contentBefore?: string;
  contentAfter?: string;
  diffMetadata?: string;
  createdFrom: CreatedFrom;
  createdAt: string;
  updatedAt: string;
  operator?: string;
  confirmedAt?: string;
  revertedAt?: string;
}

export type StatusFilter = 'all' | ItemStatus;
