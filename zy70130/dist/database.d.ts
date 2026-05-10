import { User, Collection, TransferRecord, TransferHistory, FreezeRecord, AuditLog } from './types';
export interface DatabaseState {
    users: Map<string, User>;
    collections: Map<string, Collection>;
    transferRecords: Map<string, TransferRecord>;
    transferHistories: Map<string, TransferHistory[]>;
    freezeRecords: Map<string, FreezeRecord>;
    auditLogs: Map<string, AuditLog[]>;
}
export declare function getDatabase(): DatabaseState;
export declare function closeDatabase(): void;
export declare function setDatabaseForTest(state: DatabaseState): void;
export declare function createEmptyState(): DatabaseState;
export declare function saveToFile(): void;
export declare function loadFromFile(): void;
export declare function getAuditLogsByTargetKey(targetType: string, targetId: string): string;
export declare function getFreezeKey(targetType: string, targetId: string): string;
