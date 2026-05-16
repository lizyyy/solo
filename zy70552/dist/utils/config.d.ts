import { DatabaseConfig } from '../types';
export declare function loadDatabaseConfig(configPath: string): DatabaseConfig;
export declare function loadMigrationScripts(scriptsPath: string): any[];
export declare function loadShadowData(dataPath: string): any[];
export declare function loadTableSchemas(schemasPath: string): any[];
export declare function ensureOutputDir(outputDir: string, runId: string): string;
