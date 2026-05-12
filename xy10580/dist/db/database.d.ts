import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
export declare function getDb(): Promise<SqlJsDatabase>;
export declare function saveDb(): Promise<void>;
export declare function closeDb(): void;
export declare function isDatabaseInitialized(): Promise<boolean>;
export declare function initDatabase(): Promise<void>;
export declare function generateId(): string;
export declare function dbPrepare(sql: string): Promise<{
    run: (...params: any[]) => Promise<{
        changes: number;
    }>;
    get: (...params: any[]) => Promise<initSqlJs.ParamsObject | undefined>;
    all: (...params: any[]) => Promise<Record<string, any>[]>;
}>;
//# sourceMappingURL=database.d.ts.map