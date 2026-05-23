import sqlite3 from 'sqlite3';
export declare function initDatabase(): Promise<sqlite3.Database>;
export declare let db: sqlite3.Database;
export declare function initializeDB(): Promise<void>;
export declare function getDB(): sqlite3.Database;
