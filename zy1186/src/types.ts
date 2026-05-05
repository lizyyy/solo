export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
}

export interface TableIndex {
  name: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  createStatement: string;
}

export interface WorkloadRecord {
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  table: string;
  data: Record<string, any>;
  where?: Record<string, any>;
}

export interface WriteConfig {
  benchmark: {
    warmupRuns: number;
    testRuns: number;
    recordCount: number;
  };
  strategies: {
    transactionModes: ('single' | 'batch')[];
    batchSizes: number[];
    journalModes: ('DELETE' | 'WAL' | 'MEMORY' | 'OFF')[];
    connectionModes: ('reuse' | 'reopen')[];
    statementModes: ('direct' | 'prepared')[];
  };
  indexAnalysis: {
    enable: boolean;
    testWithoutIndexes: boolean;
    testWithExtraIndexes: boolean;
    extraIndexColumns: string[];
  };
  output: {
    formats: ('markdown' | 'json' | 'csv')[];
    outputDir: string;
  };
}

export interface BenchmarkResult {
  strategy: string;
  strategyType: string;
  config: {
    transactionMode?: 'single' | 'batch';
    batchSize?: number;
    journalMode?: string;
    connectionMode?: 'reuse' | 'reopen';
    statementMode?: 'direct' | 'prepared';
    indexMode?: 'none' | 'normal' | 'extra';
  };
  metrics: {
    totalTimeMs: number;
    avgTimePerRecordMs: number;
    recordsPerSecond: number;
    memoryUsage?: number;
    fileSizeAfter?: number;
  };
  error?: string;
}

export interface OptimizationRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  expectedImprovement: string;
  action: string;
  reason: string;
}

export interface IndexRecommendation {
  action: 'ADD' | 'DROP' | 'KEEP';
  indexName: string;
  table: string;
  columns: string[];
  reason: string;
  impact: string;
}

export interface OptimizationReport {
  summary: {
    totalRecords: number;
    totalTests: number;
    bestStrategy: string;
    bestPerformance: number;
    worstStrategy: string;
    worstPerformance: number;
    improvementRatio: number;
  };
  benchmarkResults: BenchmarkResult[];
  recommendations: OptimizationRecommendation[];
  indexRecommendations: IndexRecommendation[];
  suggestedBatchSize: number;
  suggestedJournalMode: string;
  metadata: {
    generatedAt: string;
    version: string;
    config: WriteConfig;
  };
}

export interface CLIOptions {
  schema: string;
  workload: string;
  config: string;
  output?: string;
  format?: ('markdown' | 'json' | 'csv')[];
  verbose?: boolean;
  dryRun?: boolean;
}

export type StrategyType = 
  | 'transaction'
  | 'batch'
  | 'journal'
  | 'connection'
  | 'statement'
  | 'index';
