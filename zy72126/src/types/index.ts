export type TrackStatus = 'normal' | 'conflict' | 'error' | 'pending';

export type ImportStatus = 'success' | 'failed' | 'skipped' | 'processing';

export type ConflictStatus = 'pending' | 'resolved';

export type ConflictResolution = 'A' | 'B' | 'manual' | 'ignore' | 'delete_track' | 'add_to_channel';

export type ConflictType = 'value_mismatch' | 'extra_file' | 'missing_file';

export interface ChannelTableEntry {
  id: string;
  channelNo: string;
  trackName: string;
  artist?: string;
  duration?: string;
  source?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  id: string;
  channelNo: string;
  trackName: string;
  artist?: string;
  duration?: string;
  fileName: string;
  fileSize?: number;
  status: TrackStatus;
  fileHash?: string;
  metadata: Record<string, any>;
  channelTableId?: string;
  resolutionNote?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Annotation {
  id: string;
  trackId: string;
  content: string;
  author: string;
  createdAt: string;
  version: number;
  diffFromPrev?: string;
}

export interface Conflict {
  id: string;
  trackId?: string;
  channelEntryId?: string;
  conflictType: ConflictType;
  sourceA: string;
  sourceB: string;
  field: string;
  valueA: any;
  valueB: any;
  originalValueA: any;
  originalValueB: any;
  status: ConflictStatus;
  resolution?: ConflictResolution;
  manualValue?: any;
  resolvedBy?: string;
  resolutionReason?: string;
  suggestedAction: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ImportRecord {
  id: string;
  fileName: string;
  fileSize: number;
  status: ImportStatus;
  errorReason?: string;
  importedAt: string;
  trackId?: string;
}

export interface ParsedFileName {
  trackName: string;
  artist?: string;
  version?: string;
  channelNo?: string;
  duration?: string;
}

export interface AppState {
  channelTable: ChannelTableEntry[];
  tracks: Track[];
  annotations: Annotation[];
  conflicts: Conflict[];
  importRecords: ImportRecord[];
  currentPage: string;
  addChannelEntry: (entry: ChannelTableEntry) => void;
  addChannelEntries: (entries: ChannelTableEntry[]) => void;
  updateChannelEntry: (id: string, updates: Partial<ChannelTableEntry>) => void;
  deleteChannelEntry: (id: string) => void;
  addTrack: (track: Track) => void;
  updateTrack: (id: string, updates: Partial<Track>) => void;
  deleteTrack: (id: string) => void;
  addAnnotation: (annotation: Annotation) => void;
  addConflict: (conflict: Conflict) => void;
  resolveConflict: (
    id: string,
    resolution: ConflictResolution,
    options?: { manualValue?: any; resolvedBy?: string; resolutionReason?: string }
  ) => void;
  addImportRecord: (record: ImportRecord) => void;
  updateImportRecord: (id: string, updates: Partial<ImportRecord>) => void;
  setCurrentPage: (page: string) => void;
  clearAll: () => void;
  loadMockData: () => void;
}

export interface TrackWithDetails extends Track {
  annotations: Annotation[];
  conflicts: Conflict[];
  importRecord?: ImportRecord;
  channelEntry?: ChannelTableEntry;
}
