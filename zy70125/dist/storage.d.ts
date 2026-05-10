import { Database } from './types';
export declare function getDB(): Database;
export declare function updateDB(updater: (db: Database) => Database): Database;
export declare function resetDB(): void;
export declare function getDBPath(): string;
