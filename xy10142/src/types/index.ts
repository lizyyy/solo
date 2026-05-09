export interface AuditEvent {
  id: string;
  timestamp: number;
  type: 'create' | 'update' | 'delete' | 'rollback' | 'restore' | 'read' | 'login' | 'logout';
  userId: string;
  userName: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  action: string;
  details: string;
  beforeValue?: string;
  afterValue?: string;
  isRollback?: boolean;
  rollbackTargetId?: string;
  isRolledBack?: boolean;
  rollbackBy?: string;
  tags: string[];
  groupId?: string;
}

export interface TimelineEvent extends AuditEvent {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  highlighted: boolean;
}

export interface EventGroup {
  id: string;
  name: string;
  color: string;
  events: string[];
  startTimestamp: number;
  endTimestamp: number;
  collapsed: boolean;
}

export interface TimelineOptions {
  canvasWidth: number;
  canvasHeight: number;
  padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  rowHeight: number;
  eventHeight: number;
  eventGap: number;
  minZoom: number;
  maxZoom: number;
  initialZoom: number;
  colorScheme: {
    background: string;
    grid: string;
    axis: string;
    axisText: string;
    eventDefault: string;
    eventCreate: string;
    eventUpdate: string;
    eventDelete: string;
    eventRollback: string;
    eventRestore: string;
    eventRead: string;
    eventLogin: string;
    eventLogout: string;
    rollbackMarker: string;
    highlight: string;
    selection: string;
    groupHeader: string;
  };
  showGrid: boolean;
  showAxis: boolean;
  showRollbackMarkers: boolean;
  showGroupHeaders: boolean;
}

export interface TimelineState {
  events: AuditEvent[];
  timelineEvents: TimelineEvent[];
  groups: EventGroup[];
  options: TimelineOptions;
  zoom: number;
  panX: number;
  panY: number;
  startTime: number;
  endTime: number;
  visibleStartTime: number;
  visibleEndTime: number;
  searchResults: string[];
  selectedEventId: string | null;
  highlightedEventId: string | null;
  executionLog: ExecutionLogEntry[];
  isDragging: boolean;
  dragStartX: number;
  dragStartY: number;
  panStartX: number;
  panStartY: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ExecutionLogEntry {
  timestamp: number;
  action: string;
  success: boolean;
  message: string;
  details?: unknown;
}

export interface ExportOptions {
  format: 'png' | 'jpeg';
  quality: number;
  backgroundColor: string;
  includeLegend: boolean;
  includeTimestamp: boolean;
}

export interface SearchOptions {
  query: string;
  searchIn: ('action' | 'details' | 'userName' | 'resourceName' | 'resourceType' | 'tags')[];
  caseSensitive: boolean;
  exactMatch: boolean;
}

export const defaultTimelineOptions: TimelineOptions = {
  canvasWidth: 1200,
  canvasHeight: 600,
  padding: {
    top: 60,
    right: 20,
    bottom: 40,
    left: 80,
  },
  rowHeight: 50,
  eventHeight: 30,
  eventGap: 5,
  minZoom: 0.1,
  maxZoom: 10,
  initialZoom: 1,
  colorScheme: {
    background: '#1a1a2e',
    grid: '#2a2a4a',
    axis: '#4a4a6a',
    axisText: '#8a8aaa',
    eventDefault: '#6366f1',
    eventCreate: '#10b981',
    eventUpdate: '#3b82f6',
    eventDelete: '#ef4444',
    eventRollback: '#f59e0b',
    eventRestore: '#8b5cf6',
    eventRead: '#64748b',
    eventLogin: '#06b6d4',
    eventLogout: '#78716c',
    rollbackMarker: '#f59e0b',
    highlight: '#fbbf24',
    selection: '#22d3ee',
    groupHeader: '#4f46e5',
  },
  showGrid: true,
  showAxis: true,
  showRollbackMarkers: true,
  showGroupHeaders: true,
};

export const EVENT_TYPE_COLORS: Record<AuditEvent['type'], keyof TimelineOptions['colorScheme']> = {
  create: 'eventCreate',
  update: 'eventUpdate',
  delete: 'eventDelete',
  rollback: 'eventRollback',
  restore: 'eventRestore',
  read: 'eventRead',
  login: 'eventLogin',
  logout: 'eventLogout',
};
