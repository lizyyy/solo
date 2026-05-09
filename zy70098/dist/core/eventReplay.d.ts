import { EventRecord, InvitationBatch, Enrollment, OperationResult } from '../types';
export interface ReplayResult {
    reconstructedBatch?: InvitationBatch;
    reconstructedEnrollments: Enrollment[];
    replayEvents: Array<{
        event: EventRecord;
        applied: boolean;
        changes: Record<string, unknown>;
    }>;
    errors: string[];
}
export interface ReplayContext {
    initialBatch?: InvitationBatch;
    initialEnrollments: Enrollment[];
}
export declare function replayEvents(events: EventRecord[], context?: ReplayContext): OperationResult<ReplayResult>;
export declare function findEventsByBatch(events: EventRecord[], batchId: string): EventRecord[];
export declare function findEventsByEntity(events: EventRecord[], entityType: 'batch' | 'enrollment' | 'execution' | 'settlement', entityId: string): EventRecord[];
export declare function getEventTimeline(events: EventRecord[]): Array<{
    time: Date;
    eventType: string;
    entityType: string;
    fromStatus?: string;
    toStatus?: string;
    operator?: string;
}>;
