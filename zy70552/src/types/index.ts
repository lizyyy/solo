export interface DatabaseConfig {
  type: 'mysql' | 'postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface MigrationScript {
  id: string;
  name: string;
  path: string;
  sql: string;
  rollbackSql?: string;
  order: number;
}

export interface ShadowData {
  tableName: string;
  rows: Record<string, any>[];
  primaryKey?: string[];
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  indexes: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
}

export interface ExecutionResult {
  scriptId: string;
  scriptName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  affectedRows: number;
  error?: ExecutionError;
  rollbackResult?: RollbackResult;
  rowChanges?: RowChange[];
}

export interface ExecutionError {
  message: string;
  code?: string;
  sqlState?: string;
  position?: number;
  sqlSnippet?: string;
}

export interface RowChange {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  primaryKeyValues: Record<string, any>;
  before?: Record<string, any>;
  after?: Record<string, any>;
}

export interface RollbackResult {
  success: boolean;
  verified: boolean;
  verificationErrors?: string[];
  affectedRows: number;
  error?: ExecutionError;
}

export interface BadRow {
  id: string;
  tableName: string;
  rowIndex: number;
  primaryKeyValues: Record<string, any>;
  reason: string;
  error?: ExecutionError;
  rawData: Record<string, any>;
  sourceFile?: string;
  sourceLine?: number;
}

export interface ReplayReport {
  runId: string;
  startTime: Date;
  endTime: Date;
  totalDurationMs: number;
  databaseConfig: {
    type: string;
    host: string;
    database: string;
  };
  summary: {
    totalScripts: number;
    successfulScripts: number;
    failedScripts: number;
    totalAffectedRows: number;
    badRowsCount: number;
    rollbackSuccessRate: number;
  };
  executionResults: ExecutionResult[];
  badRows: BadRow[];
  inputFiles: {
    migrationScripts: string[];
    shadowData: string[];
    tableSchemas: string[];
  };
  outputFiles: {
    jsonReport: string;
    markdownReport: string;
    executionLog: string;
  };
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
