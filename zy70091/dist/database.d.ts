import { Database as SqlJsDatabase } from 'sql.js';
interface SqlJsStatement {
    bind(params?: any[]): boolean;
    step(): boolean;
    get(params?: any[]): any[];
    getAsObject(params?: any[]): any;
    run(params?: any[]): void;
    free(): boolean;
}
export declare class DatabaseConnection {
    private static instance;
    private static initPromise;
    private db;
    private dbPath;
    private constructor();
    static getInstanceAsync(dbPath?: string): Promise<DatabaseConnection>;
    static getInstance(dbPath?: string): DatabaseConnection;
    private initSchema;
    private initSchemaSync;
    private saveToDisk;
    getDatabase(): SqlJsDatabase;
    close(): void;
    prepare(sql: string): SqlJsStatement;
    exec(sql: string): void;
    transaction<T>(fn: () => T): T;
    static reset(): void;
    static setInitializedModule(module: any): void;
}
export default DatabaseConnection;
