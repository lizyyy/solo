import { Conflict, ConflictResolution, Event } from '../types';
declare class ConflictService {
    detectVersionConflict(aggregateId: string, incomingEvent: Event, existingEvents: Event[]): Conflict | null;
    detectConcurrentEdit(aggregateId: string, incomingEvent: Event, existingEvents: Event[]): Conflict | null;
    detectDataInconsistency(aggregateId: string, events: Event[]): Conflict | null;
    detectAllConflicts(aggregateId: string, incomingEvent: Event, existingEvents: Event[]): Promise<Conflict[]>;
    persistConflict(conflict: Conflict): Promise<void>;
    resolveConflict(conflictId: string, resolution: ConflictResolution, resolvedBy: string): Promise<Conflict>;
    getConflictById(conflictId: string): Conflict | null;
    getConflictsByAggregate(aggregateId: string, status?: Conflict['status']): Conflict[];
    getPendingConflicts(limit?: number): Conflict[];
    mergeEvents(events: Event[]): Promise<Record<string, unknown>>;
    private applyEventToState;
    private deserializeConflict;
}
export declare const conflictService: ConflictService;
export {};
