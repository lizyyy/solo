export interface DBProfile {
  database: {
    type: 'mysql' | 'postgresql' | 'sqlite';
    host: string;
    port: number;
    database: string;
  };
  connectionPool: {
    maxConnections: number;
    minConnections: number;
    maxWaitQueueSize: number;
    connectionTimeoutMs: number;
    idleTimeoutMs: number;
  };
  readWriteSeparation: {
    enabled: boolean;
    readReplicas: number;
    routingStrategy: 'round-robin' | 'least-connections' | 'latency-based';
  };
  sharding: {
    enabled: boolean;
    shardCount: number;
    shardKey: string;
    algorithm: 'hash' | 'range' | 'modulo';
  };
}

export interface SchemaSQL {
  tables: TableDefinition[];
  indexes: IndexDefinition[];
  constraints: ConstraintDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  primaryKey?: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
  type: 'PRIMARY' | 'UNIQUE' | 'INDEX' | 'FULLTEXT';
}

export interface ConstraintDefinition {
  name: string;
  table: string;
  type: 'FOREIGN KEY' | 'CHECK' | 'UNIQUE';
  definition: string;
}

export interface SQLTraceEntry {
  timestamp: number;
  traceId: string;
  spanId: string;
  sql: string;
  params: any[];
  durationMs: number;
  connectionId: string;
  isRead: boolean;
  shardKey?: string;
  shardId?: number;
  rowsAffected?: number;
  rowsReturned?: number;
  error?: string;
}

export interface WriteBatch {
  batchId: string;
  timestamp: number;
  table: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowCount: number;
  values: any[];
  shardKey?: string;
  shardId?: number;
}

export interface ShardingPlan {
  shards: ShardConfig[];
  tables: TableShardingConfig[];
  routingRules: RoutingRule[];
}

export interface ShardConfig {
  id: number;
  name: string;
  host: string;
  port: number;
  database: string;
  weight: number;
}

export interface TableShardingConfig {
  table: string;
  shardKey: string;
  shardCount: number;
  algorithm: 'hash' | 'range' | 'modulo';
}

export interface RoutingRule {
  pattern: string;
  shardIds: number[];
  priority: number;
}

export interface AnalysisResult {
  summary: AnalysisSummary;
  issues: Issue[];
  suggestions: Suggestion[];
  metrics: AnalysisMetrics;
  rawData: {
    traceCount: number;
    batchCount: number;
    tableCount: number;
  };
}

export interface AnalysisSummary {
  canDeploy: boolean;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
}

export interface Issue {
  id: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  description: string;
  affectedObjects: string[];
  evidence: string;
}

export type IssueCategory = 
  | 'connection-pool'
  | 'write-batch'
  | 'index'
  | 'slow-sql'
  | 'routing'
  | 'sharding'
  | 'configuration';

export type Severity = 'blocker' | 'warning' | 'info';

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  implementation: string;
}

export interface AnalysisMetrics {
  connectionPool: ConnectionPoolMetrics;
  writePerformance: WritePerformanceMetrics;
  indexUsage: IndexUsageMetrics;
  slowSQL: SlowSQLMetrics;
  routing: RoutingMetrics;
  sharding: ShardingMetrics;
}

export interface ConnectionPoolMetrics {
  avgQueueSize: number;
  maxQueueSize: number;
  queueRate: number;
  avgConnectionWaitMs: number;
  connectionUtilization: number;
  timeoutRate: number;
}

export interface WritePerformanceMetrics {
  singleWriteCount: number;
  batchWriteCount: number;
  avgSingleWriteMs: number;
  avgBatchWriteMs: number;
  totalRowsWritten: number;
  batchSizeDistribution: Record<number, number>;
}

export interface IndexUsageMetrics {
  usedIndexes: string[];
  unusedIndexes: string[];
  missingIndexes: string[];
  duplicateIndexes: string[];
  indexScanCount: Record<string, number>;
}

export interface SlowSQLMetrics {
  totalCount: number;
  avgDurationMs: number;
  p95DurationMs: number;
  slowQueries: SlowQuery[];
}

export interface SlowQuery {
  sql: string;
  avgDurationMs: number;
  count: number;
  maxDurationMs: number;
  isRead: boolean;
}

export interface RoutingMetrics {
  readCount: number;
  writeCount: number;
  misroutedReads: number;
  misroutedWrites: number;
  replicaUtilization: Record<string, number>;
}

export interface ShardingMetrics {
  shardDistribution: Record<number, number>;
  hotspots: ShardHotspot[];
  avgRowsPerShard: number;
  imbalanceRatio: number;
}

export interface ShardHotspot {
  shardId: number;
  table: string;
  shardKeyValue: string;
  rowCount: number;
  percentage: number;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
