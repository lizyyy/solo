import Database from 'better-sqlite3';
export declare function initDatabase(): Database.Database;
export declare function getDatabase(): Database.Database;
export declare function executeTransaction<T>(fn: () => Promise<T> | T): Promise<T>;
