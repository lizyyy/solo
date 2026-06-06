export type RecordStatus = 'pending' | 'normal' | 'review' | 'completed';

export interface Track {
  id: string;
  name: string;
  trackNumber: number;
  remark: string;
  hasReworkReason: boolean;
  reworkReason?: string;
  alias?: string;
  oldAlias?: string;
}

export interface RehearsalChange {
  id: string;
  trackId: string;
  changeType: 'name' | 'alias' | 'other';
  oldValue: string;
  newValue: string;
  changedAt: string;
  changedBy: string;
}

export type EvidenceType = 'import' | 'parse' | 'alias_update' | 'rehearsal_update' | 'review' | 'complete' | 'manual_fix' | 'rerun';

export interface EvidenceNode {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  operator: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface RoyaltyRecord {
  id: string;
  contractNo: string;
  recordStore: string;
  importDate: string;
  status: RecordStatus;
  contractImage: string;
  tracks: Track[];
  evidenceChain: EvidenceNode[];
  rehearsalChanges: RehearsalChange[];
  reviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface TrackAlias {
  id: string;
  officialName: string;
  aliases: string[];
  oldCaliber?: string;
  updatedAt: string;
}

export interface ReviewAction {
  recordId: string;
  action: 'approve' | 'reject';
  note: string;
  operator: string;
}
