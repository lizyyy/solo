export interface DatabaseConfig {
    type: 'mysql' | 'postgresql';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
}
export interface ReplayOptions {
    migrationScriptsPath: string;
    shadowDataPath: string;
    tableSchemasPath: string;
    outputDir: string;
    databaseConfig: DatabaseConfig;
    failFast?: boolean;
    verifyRollback?: boolean;
    preserveFailedState?: boolean;
    runId?: string;
}
export interface ReplayReport {
    runId: string;
    summary: {
        totalScripts: number;
        successfulScripts: number;
        failedScripts: number;
        badRowsCount: number;
    };
}
