import { DatabaseConfig } from '../types';
export declare abstract class DatabaseEngine {
    protected config: DatabaseConfig;
    constructor(config: DatabaseConfig);
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract executeQuery(sql: string): Promise<{
        rows: any[];
        affectedRows: number;
    }>;
    abstract beginTransaction(): Promise<void>;
    abstract commitTransaction(): Promise<void>;
    abstract rollbackTransaction(): Promise<void>;
}
