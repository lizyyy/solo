import { DatabaseConfig, MigrationScript, TableSchema, ShadowData } from '../types';
export declare function loadDatabaseConfig(configPath: string): DatabaseConfig;
export declare function loadMigrationScripts(scriptsPath: string): MigrationScript[];
export declare function loadShadowData(dataPath: string): ShadowData[];
export declare function loadTableSchemas(schemasPath: string): TableSchema[];
export declare function ensureOutputDir(outputDir: string, runId: string): string;
