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
export declare const defaultTimelineOptions: TimelineOptions;
export declare const EVENT_TYPE_COLORS: Record<AuditEvent['type'], keyof TimelineOptions['colorScheme']>;
//# sourceMappingURL=index.d.ts.map