export type TrackStatus = 'normal' | 'conflict' | 'error' | 'pending';

export type ImportStatus = 'success' | 'failed' | 'skipped' | 'processing';

export type ConflictStatus = 'pending' | 'resolved';

export type ConflictResolution = 'A' | 'B' | 'manual';

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
  trackId: string;
  sourceA: string;
  sourceB: string;
  field: string;
  valueA: any;
  valueB: any;
  status: ConflictStatus;
  resolution?: ConflictResolution;
  manualValue?: any;
  suggestedAction: string;
  resolvedAt?: string;
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
  resolveConflict: (id: string, resolution: ConflictResolution, manualValue?: any) => void;
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
