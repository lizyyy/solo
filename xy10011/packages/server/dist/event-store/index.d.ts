import { Event, EventType } from '../types';
declare class EventStore {
    private sequenceCounter;
    appendEvent(aggregateId: string, aggregateType: 'bill' | 'group' | 'user' | 'system', eventType: EventType, payload: Record<string, unknown>, userId: string, clientId: string, expectedVersion: number, metadata?: {
        ipAddress?: string;
        userAgent?: string;
        correlationId?: string;
    }): Promise<Event>;
    private getCurrentVersion;
    private getNextSequence;
    private persistEvent;
    getEventsByAggregate(aggregateId: string, fromVersion?: number): Event[];
    getEventsByType(eventType: EventType, limit?: number): Event[];
    getEventsByUser(userId: string, limit?: number): Event[];
    getEventsByTimeRange(startTime: number, endTime: number): Event[];
    getEventById(eventId: string): Event | null;
    replayEvents(aggregateId: string, untilVersion?: number): Event[];
    private deserializeEvent;
}
export declare class VersionConflictError extends Error {
    aggregateId: string;
    expectedVersion: number;
    actualVersion: number;
    constructor(aggregateId: string, expectedVersion: number, actualVersion: number);
}
export declare const eventStore: EventStore;
export {};
