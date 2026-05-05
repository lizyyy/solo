import { SqlQuery } from './sql-query';
import { RequestGroup } from './request-group';
import { Issue } from './analysis-result';

export type OptimizationType = 
  | 'PRELOAD' 
  | 'BATCH_QUERY' 
  | 'FIELD_TRIMMING' 
  | 'CURSOR_PAGINATION'
  | 'INDEX_OPTIMIZATION';

export interface SimulationResult {
  requestId: string;
  originalRequestGroup: RequestGroup;
  optimizations: Optimization[];
  comparison: Comparison;
  simulationTime: Date;
}

export interface Optimization {
  id: string;
  type: OptimizationType;
  title: string;
  description: string;
  targetIssues: string[];
  originalQueries: SqlQuery[];
  optimizedQueries: OptimizedQuery[];
  impact: OptimizationImpact;
  before: OptimizationSnapshot;
  after: OptimizationSnapshot;
}

export interface OptimizedQuery {
  sql: string;
  normalizedSql: string;
  parameters: any[];
  estimatedDuration: number;
  estimatedRows: number;
  explanation?: string;
}

export interface OptimizationImpact {
  queryCountChange: number;
  queryCountChangePercent: number;
  durationChangeMs: number;
  durationChangePercent: number;
  dataTransferChangeBytes: number;
  dataTransferChangePercent: number;
}

export interface OptimizationSnapshot {
  queryCount: number;
  totalDurationMs: number;
  totalDataTransferBytes: number;
  queries: {
    sql: string;
    duration: number;
    dataTransferBytes: number;
  }[];
}

export interface Comparison {
  original: ComparisonMetrics;
  optimized: ComparisonMetrics;
  improvement: ImprovementMetrics;
}

export interface ComparisonMetrics {
  totalRequests: number;
  totalQueries: number;
  totalDurationMs: number;
  totalDataTransferBytes: number;
  avgQueriesPerRequest: number;
  avgDurationPerRequest: number;
}

export interface ImprovementMetrics {
  queryCountReduction: number;
  queryCountReductionPercent: number;
  durationReductionMs: number;
  durationReductionPercent: number;
  dataTransferReductionBytes: number;
  dataTransferReductionPercent: number;
}

export interface SimulationOptions {
  simulatePreload?: boolean;
  simulateBatchQuery?: boolean;
  simulateFieldTrimming?: boolean;
  simulateCursorPagination?: boolean;
  simulateIndexOptimization?: boolean;
  batchSize?: number;
  estimatedQueryTimePerRowMs?: number;
  estimatedDataTransferPerRowBytes?: number;
}

export const DEFAULT_SIMULATION_OPTIONS: SimulationOptions = {
  simulatePreload: true,
  simulateBatchQuery: true,
  simulateFieldTrimming: true,
  simulateCursorPagination: true,
  simulateIndexOptimization: true,
  batchSize: 100,
  estimatedQueryTimePerRowMs: 0.1,
  estimatedDataTransferPerRowBytes: 200,
};

export interface SimulationPlan {
  requestId: string;
  issues: Issue[];
  proposedOptimizations: ProposedOptimization[];
}

export interface ProposedOptimization {
  type: OptimizationType;
  title: string;
  description: string;
  targetIssueIds: string[];
  estimatedBenefit: {
    queryCountReduction?: number;
    durationReductionMs?: number;
    dataTransferReductionBytes?: number;
  };
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
}
