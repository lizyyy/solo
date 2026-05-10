import { Event, SyncState } from '../types';
declare class SyncService {
    private syncLock;
    sync(clientId: string, localEvents: Event[], lastKnownServerVersion: number): Promise<{
        success: boolean;
        eventsToApply: Event[];
        conflicts: Array<{
            localEvent: Event;
            serverEvent: Event;
        }>;
        newServerVersion: number;
    }>;
    private appendSystemEvent;
    private getSystemEventsByAggregate;
    private applyRemoteEvent;
    private getEventsSinceVersion;
    private getLatestVersion;
    getSyncState(): SyncState;
    private updateSyncState;
    queueForSync(event: Event): Promise<void>;
    replayEvents(aggregateId: string, targetVersion: number): Promise<boolean>;
}
export declare const syncService: SyncService;
export {};
