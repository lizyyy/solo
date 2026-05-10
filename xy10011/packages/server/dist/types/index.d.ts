export interface User {
    id: string;
    name: string;
    avatar?: string;
    createdAt: number;
    updatedAt: number;
}
export interface Participant {
    userId: string;
    share: number;
    paid: number;
    adjustedShare?: number;
}
export interface Bill {
    id: string;
    groupId: string;
    title: string;
    description?: string;
    amount: number;
    currency: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    version: number;
    participants: Participant[];
    tags?: string[];
    deleted: boolean;
}
export interface Group {
    id: string;
    name: string;
    description?: string;
    members: string[];
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    version: number;
}
export type EventType = 'BILL_CREATED' | 'BILL_UPDATED' | 'BILL_DELETED' | 'GROUP_CREATED' | 'GROUP_UPDATED' | 'GROUP_DELETED' | 'USER_CREATED' | 'USER_UPDATED' | 'SYNC_STARTED' | 'SYNC_COMPLETED' | 'SYNC_FAILED' | 'CACHE_INVALIDATED' | 'TRANSACTION_ROLLBACK';
export interface Event {
    id: string;
    eventType: EventType;
    aggregateId: string;
    aggregateType: 'bill' | 'group' | 'user' | 'system';
    payload: Record<string, unknown>;
    previousVersion: number;
    newVersion: number;
    userId: string;
    timestamp: number;
    clientId: string;
    ipAddress?: string;
    userAgent?: string;
    correlationId?: string;
    sequence: number;
}
export interface ConflictResolution {
    strategy: 'last-write-wins' | 'merge' | 'reject' | 'ask-user';
    resolvedBy?: string;
    resolvedAt?: number;
    notes?: string;
}
export interface Conflict {
    id: string;
    eventId1: string;
    eventId2: string;
    aggregateId: string;
    type: 'version-mismatch' | 'concurrent-edit' | 'data-inconsistency';
    status: 'pending' | 'resolved' | 'ignored';
    resolution?: ConflictResolution;
    detectedAt: number;
}
export interface SyncState {
    lastSyncedAt: number;
    pendingEvents: string[];
    syncStatus: 'idle' | 'syncing' | 'error' | 'conflict';
    serverVersion: number;
    localVersion: number;
}
export interface AuditLogEntry {
    eventId: string;
    action: string;
    user: string;
    timestamp: number;
    changes: string;
}
export interface ReportOptions {
    format: 'excel' | 'markdown' | 'pdf';
    groupId?: string;
    startDate?: number;
    endDate?: number;
    includeDetails: boolean;
    includeAuditLog: boolean;
}
