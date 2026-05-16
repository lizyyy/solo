import { DatabaseEngine } from "./database";
export declare class MySqlEngine extends DatabaseEngine {
    private connection;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    executeQuery(sql: string): Promise<{
        rows: any[];
        affectedRows: number;
    }>;
    beginTransaction(): Promise<void>;
    commitTransaction(): Promise<void>;
    rollbackTransaction(): Promise<void>;
}
