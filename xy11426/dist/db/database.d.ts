import Database from 'better-sqlite3';
export declare function getDbPath(): string;
export declare function getDatabase(): Database.Database;
export declare function closeDatabase(): void;
export declare function initDatabase(): void;
export declare function isDatabaseInitialized(): boolean;
