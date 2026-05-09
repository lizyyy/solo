import type { AuditEvent, EventGroup, TimelineOptions, TimelineState, SearchOptions, ExportOptions } from '../types';
import { ExecutionLogger } from '../logger';
export declare class CanvasAuditTimeline {
    private canvas;
    private ctx;
    private state;
    private logger;
    private animationFrameId;
    constructor(options?: Partial<TimelineOptions>);
    attach(canvas: HTMLCanvasElement): void;
    private setupEventListeners;
    private handleWheel;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleClick;
    addEvent(event: AuditEvent): boolean;
    addEvents(events: AuditEvent[]): {
        success: number;
        failed: number;
        errors: Array<{
            event: Partial<AuditEvent>;
            errors: unknown[];
        }>;
    };
    addGroup(group: EventGroup): boolean;
    private updateTimeRange;
    private updateVisibleTimeRange;
    private updateTimelineEventPositions;
    private findEventAtPosition;
    setZoom(zoom: number): void;
    zoomIn(): void;
    zoomOut(): void;
    resetZoom(): void;
    search(options: SearchOptions): string[];
    clearSearch(): void;
    highlightEvent(eventId: string): void;
    centerOnEvent(eventId: string): void;
    getRollbackPairs(): Array<{
        rollback: AuditEvent;
        target: AuditEvent | undefined;
    }>;
    exportImage(options?: ExportOptions): string | null;
    downloadImage(filename?: string, options?: ExportOptions): void;
    private drawLegend;
    render(): void;
    private doRender;
    private drawGrid;
    private calculateTimeInterval;
    private drawTimeAxis;
    private formatTime;
    private drawResourceAxis;
    private drawRollbackMarkers;
    private drawGroupHeaders;
    private drawEvents;
    private drawSelection;
    getEvents(): AuditEvent[];
    getGroups(): EventGroup[];
    getSelectedEvent(): AuditEvent | null;
    getState(): Readonly<TimelineState>;
    getLogger(): ExecutionLogger;
    getExecutionLogs(): import("../types").ExecutionLogEntry[];
    destroy(): void;
}
//# sourceMappingURL=index.d.ts.map