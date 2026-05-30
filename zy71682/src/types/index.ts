export enum RequirementStatus {
  NORMAL = 'normal',
  PENDING = 'pending',
  CONFLICT = 'conflict'
}

export enum ConflictType {
  CHANNEL_DUPLICATE = 'channel_duplicate',
  MONITOR_MISSING = 'monitor_missing',
  CHANGE_OVER_TIMEOUT = 'change_over_timeout'
}

export type ChannelType = 'vocals' | 'guitar' | 'bass' | 'drums' | 'keys' | 'other';

export type MonitorPosition = 'stage_left' | 'stage_center' | 'stage_right' | 'drummer';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  assignedTo: string;
  order: number;
  notes?: string;
}

export interface Monitor {
  id: string;
  name: string;
  position: MonitorPosition;
  mix: Record<string, number>;
  notes?: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  description: string;
  severity: 'warning' | 'error';
  relatedItemIds: string[];
  resolved: boolean;
}

export interface BandRequirement {
  id: string;
  bandName: string;
  performanceDate: string;
  startTime: string;
  endTime: string;
  changeOverTime: number;
  channels: Channel[];
  monitors: Monitor[];
  stageNotes: string;
  status: RequirementStatus;
  conflicts: Conflict[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface VersionRecord {
  id: string;
  requirementId: string;
  versionNumber: number;
  snapshot: BandRequirement;
  changeSummary: string;
  createdAt: string;
  createdBy: string;
}

export interface FilterSnapshot {
  id: string;
  name: string;
  filters: FilterCriteria;
  createdAt: string;
}

export interface FilterCriteria {
  bandName?: string;
  status?: RequirementStatus[];
  dateFrom?: string;
  dateTo?: string;
  hasConflict?: boolean;
}

export interface ExportRecord {
  id: string;
  snapshotId?: string;
  filterCriteria: FilterCriteria;
  format: 'pdf' | 'excel' | 'json';
  fileHash: string;
  recordCount: number;
  createdAt: string;
}

export interface AppState {
  requirements: BandRequirement[];
  versions: VersionRecord[];
  filterSnapshots: FilterSnapshot[];
  exportHistory: ExportRecord[];
  globalChannels: Channel[];
  globalMonitors: Monitor[];
  currentFilters: FilterCriteria;
  selectedVersion: number | null;
}

export interface ChangeDiff {
  channels: {
    added: Channel[];
    removed: Channel[];
    modified: { from: Channel; to: Channel }[];
  };
  monitors: {
    added: Monitor[];
    removed: Monitor[];
    modified: { from: Monitor; to: Monitor }[];
  };
  changeOverTime: { from: number; to: number } | null;
  stageNotes: { from: string; to: string } | null;
  startTime: { from: string; to: string } | null;
  endTime: { from: string; to: string } | null;
}

export interface ExportMetadata {
  exportVersion: string;
  exportedAt: string;
  filterCriteria: FilterCriteria;
  recordCount: number;
  dataHash: string;
  reproducibilityNote: string;
}
