import { Database, Task, Escort, IdempotencyRecord } from '../models/types';
export declare class StorageService {
    private dbPath;
    private cache;
    constructor(dbPath?: string);
    private ensureDataDirectory;
    private getDefaultDatabase;
    load(): Database;
    save(db: Database): void;
    saveBackup(): string;
    getTasks(): Task[];
    getTaskById(id: string): Task | undefined;
    saveTask(task: Task): void;
    getEscorts(): Escort[];
    getEscortById(id: string): Escort | undefined;
    saveEscort(escort: Escort): void;
    getIdempotencyRecord(key: string): IdempotencyRecord | undefined;
    saveIdempotencyRecord(record: IdempotencyRecord): void;
    clearExpiredIdempotencyRecords(expireMs?: number): number;
    exportData(exportPath: string, includeSensitive?: boolean): void;
    importData(importPath: string): void;
    resetDatabase(): void;
    getDbPath(): string;
}
export declare const storage: StorageService;
