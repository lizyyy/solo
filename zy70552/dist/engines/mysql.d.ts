import { DatabaseEngine } from './database';
import { DatabaseConfig } from '../types';
export declare class MySqlEngine extends DatabaseEngine {
    private connection;
    constructor(config: DatabaseConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    executeQuery(sql: string): Promise<{
        rows: any[];
        affectedRows: number;
    }>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
    tableExists(tableName: string): Promise<boolean>;
    getTableRowCount(tableName: string): Promise<number>;
}
