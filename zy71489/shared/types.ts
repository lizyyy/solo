export interface SourceInfo {
  sourceType: 'manual' | 'csv-import' | 'api';
  fileName?: string;
  lineNumber?: number;
  rawContent?: string;
  importedBy: string;
  importedAt: string;
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  duration: number;
  staminaLevel: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  source: SourceInfo;
  createdAt: string;
  updatedAt: string;
}

export interface Vote {
  id: string;
  trackId: string;
  trackName: string;
  voterId?: string;
  voterName?: string;
  votedAt: string;
  isDuplicate: boolean;
  duplicateOf?: string;
  source: SourceInfo;
}

export interface Copyright {
  id: string;
  trackId: string;
  trackName: string;
  status: 'active' | 'expired' | 'pending' | 'restricted';
  expiredAt?: string;
  warningLevel: 'high' | 'medium' | 'low';
  licenseNumber?: string;
  source: SourceInfo;
  updatedAt: string;
}

export interface Decision {
  id: string;
  name: string;
  selectedTrackIds: string[];
  totalDuration: number;
  totalVotes: number;
  avgStamina: number;
  copyrightRisk: 'none' | 'low' | 'medium' | 'high';
  filters: FilterCriteria;
  deduplicationRules: DedupeRule[];
  snapshot: {
    tracks: Track[];
    votes: Vote[];
    copyrights: Copyright[];
  };
  decisionReason?: string;
  createdAt: string;
  createdBy: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'import' | 'decision' | 'export';
  entityType: 'track' | 'vote' | 'copyright' | 'decision';
  entityId?: string;
  beforeChange?: any;
  afterChange?: any;
  operator: string;
  timestamp: string;
  ip?: string;
}

export interface BadDataRecord {
  id: string;
  sourceFile: string;
  lineNumber: number;
  rawContent: string;
  errorType: 'missing_field' | 'invalid_format' | 'invalid_duration' | 'duplicate' | 'unknown_track';
  errorMessage: string;
  detectedAt: string;
  importSession: string;
}

export interface Stats {
  totalTracks: number;
  totalVotes: number;
  expiredCopyrights: number;
  selectedCount: number;
  totalDuration: number;
  totalSelectedVotes: number;
  avgStamina: number;
  hasCopyrightRisk: boolean;
}

export interface FilterCriteria {
  copyrightStatus?: ('active' | 'pending')[];
  minVotes?: number;
  maxDuration?: number;
  maxStamina?: number;
  searchKeyword?: string;
}

export interface DedupeRule {
  field: 'voterId' | 'voterName' | 'trackName';
  enabled: boolean;
}

export interface TrackWithRelations extends Track {
  voteCount: number;
  copyright?: Copyright;
  isSelected: boolean;
}

export interface ImportResult {
  success: number;
  failed: number;
  duplicates: number;
  badData: BadDataRecord[];
}
