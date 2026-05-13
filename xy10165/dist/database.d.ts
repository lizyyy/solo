import Database from 'better-sqlite3';
export declare function getDatabase(dbPath?: string): Database.Database;
export declare function closeDatabase(): void;
export declare function initializeDatabase(dbPath?: string, force?: boolean): void;
export declare function databaseExists(dbPath?: string): boolean;
//# sourceMappingURL=database.d.ts.map