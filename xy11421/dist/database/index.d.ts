import { Database } from 'sqlite';
export declare function getDbPath(): string;
export declare function initDatabase(): Promise<Database>;
export declare function getDatabase(): Promise<Database>;
export declare function closeDatabase(): Promise<void>;
