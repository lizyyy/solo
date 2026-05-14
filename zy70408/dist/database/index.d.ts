import sqlite3 from 'sqlite3';
export declare const db: sqlite3.Database;
export declare function runQuery(sql: string, params?: any[]): Promise<any>;
export declare function getQuery<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
export declare function allQuery<T = any>(sql: string, params?: any[]): Promise<T[]>;
