export type TimeSource = 'ORBIT' | 'TELEMETRY' | 'MANUAL';

export type TimeSystem = 'UTC' | 'TAI' | 'LOCAL';

export type WindowStatus = 'NORMAL' | 'CONFLICT' | 'RESOLVED';

export type ConflictType = 'OVERLAP' | 'TIME_FORMAT_MIX';

export type ConflictStatus = 'DETECTED' | 'RESOLVED' | 'IGNORED';

export type HistoryAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'RESOLVE';

export type TargetType = 'WINDOW' | 'CONFLICT' | 'SETTINGS';

export interface TransitWindow {
  id: string;
  satelliteId: string;
  satelliteName: string;
  startTime: string;
  endTime: string;
  timeSource: TimeSource;
  timeSystem: TimeSystem;
  status: WindowStatus;
  description: string;
  color: string;
  priority: number;
  dataSourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conflict {
  id: string;
  windowId1: string;
  windowId2?: string;
  type: ConflictType;
  reason: string;
  suggestion: string;
  nextStep: string;
  status: ConflictStatus;
  detectedAt: string;
  overlapDuration?: number;
}

export interface HistoryRecord {
  id: string;
  action: HistoryAction;
  targetType: TargetType;
  targetId: string;
  beforeState: unknown;
  afterState: unknown;
  operator: string;
  remark: string;
  timestamp: string;
}

export interface DataSource {
  id: string;
  type: 'ORBIT_ELEMENTS' | 'TELEMETRY';
  name: string;
  timeSystem: TimeSystem;
  importedAt: string;
  rawData: unknown;
}

export interface ViewState {
  startTime: string;
  endTime: string;
  zoom: number;
  panX: number;
  filters: {
    satellites: string[];
    statuses: WindowStatus[];
    timeSources: TimeSource[];
  };
}

export interface ImportData {
  type: 'ORBIT_ELEMENTS' | 'TELEMETRY';
  name: string;
  timeSystem: TimeSystem;
  windows: Array<{
    satelliteId: string;
    satelliteName: string;
    startTime: string;
    endTime: string;
    description?: string;
    color?: string;
    priority?: number;
  }>;
}

export interface ImportResult {
  success: boolean;
  dataSourceId: string;
  importedCount: number;
  conflicts: Conflict[];
  warnings: string[];
}

export interface BriefingData {
  generatedAt: string;
  viewRange: {
    startTime: string;
    endTime: string;
  };
  windows: TransitWindow[];
  conflicts: Conflict[];
  summary: {
    totalWindows: number;
    normalCount: number;
    conflictCount: number;
    resolvedCount: number;
  };
}

export const STORAGE_KEYS = {
  WINDOWS: 'satellite_transit_windows',
  CONFLICTS: 'satellite_transit_conflicts',
  HISTORY: 'satellite_transit_history',
  DATA_SOURCES: 'satellite_data_sources',
  VIEW_STATE: 'satellite_view_state',
  SETTINGS: 'satellite_app_settings'
} as const;

export const SATELLITE_COLORS = [
  '#00d4ff',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#af52de',
  '#5856d6',
  '#ffcc00',
  '#ff2d55',
];

export const TIME_SOURCE_LABELS: Record<TimeSource, string> = {
  ORBIT: '轨道根数',
  TELEMETRY: '遥测片段',
  MANUAL: '手动录入',
};

export const TIME_SYSTEM_LABELS: Record<TimeSystem, string> = {
  UTC: 'UTC',
  TAI: 'TAI',
  LOCAL: '本地时间',
};

export const WINDOW_STATUS_LABELS: Record<WindowStatus, string> = {
  NORMAL: '正常',
  CONFLICT: '冲突',
  RESOLVED: '已解决',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  OVERLAP: '窗口重叠',
  TIME_FORMAT_MIX: '时间制式混合',
};
