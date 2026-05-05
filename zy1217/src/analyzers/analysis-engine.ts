import { 
  AnalysisResult, 
  AnalysisSummary, 
  Issue, 
  Suggestion,
  AnalysisMetrics,
  DBProfile,
  SchemaSQL,
  SQLTraceEntry,
  WriteBatch,
  ShardingPlan,
  Severity
} from '../types';

import { ConnectionPoolAnalyzer } from './connection-pool-analyzer';
import { WritePerformanceAnalyzer } from './write-performance-analyzer';
import { IndexAnalyzer } from './index-analyzer';
import { SlowSQLAnalyzer } from './slow-sql-analyzer';
import { RoutingAnalyzer } from './routing-analyzer';
import { ShardingAnalyzer } from './sharding-analyzer';

export interface AnalysisConfig {
  slowThresholdMs?: number;
  enableShardingAnalysis?: boolean;
}

export class AnalysisEngine {
  private dbProfile: DBProfile;
  private schema: SchemaSQL;
  private traceEntries: SQLTraceEntry[];
  private writeBatches: WriteBatch[];
  private shardingPlan?: ShardingPlan;
  private config: AnalysisConfig;

  constructor(
    dbProfile: DBProfile,
    schema: SchemaSQL,
    traceEntries: SQLTraceEntry[],
    writeBatches: WriteBatch[],
    shardingPlan?: ShardingPlan,
    config: AnalysisConfig = {}
  ) {
    this.dbProfile = dbProfile;
    this.schema = schema;
    this.traceEntries = traceEntries;
    this.writeBatches = writeBatches;
    this.shardingPlan = shardingPlan;
    this.config = {
      slowThresholdMs: 500,
      enableShardingAnalysis: true,
      ...config
    };
  }

  analyze(): AnalysisResult {
    const allIssues: Issue[] = [];
    const allSuggestions: Suggestion[] = [];

    const connectionPoolAnalyzer = new ConnectionPoolAnalyzer(this.dbProfile, this.traceEntries);
    const connectionPoolMetrics = connectionPoolAnalyzer.analyze();
    allIssues.push(...connectionPoolAnalyzer.getIssues());
    allSuggestions.push(...connectionPoolAnalyzer.getSuggestions());

    const writePerformanceAnalyzer = new WritePerformanceAnalyzer(this.traceEntries, this.writeBatches);
    const writePerformanceMetrics = writePerformanceAnalyzer.analyze();
    allIssues.push(...writePerformanceAnalyzer.getIssues());
    allSuggestions.push(...writePerformanceAnalyzer.getSuggestions());

    const indexAnalyzer = new IndexAnalyzer(this.schema, this.traceEntries);
    const indexUsageMetrics = indexAnalyzer.analyze();
    allIssues.push(...indexAnalyzer.getIssues());
    allSuggestions.push(...indexAnalyzer.getSuggestions());

    const slowSQLAnalyzer = new SlowSQLAnalyzer(this.traceEntries, this.config.slowThresholdMs);
    const slowSQLMetrics = slowSQLAnalyzer.analyze();
    allIssues.push(...slowSQLAnalyzer.getIssues());
    allSuggestions.push(...slowSQLAnalyzer.getSuggestions());

    const routingAnalyzer = new RoutingAnalyzer(this.dbProfile, this.traceEntries);
    const routingMetrics = routingAnalyzer.analyze();
    allIssues.push(...routingAnalyzer.getIssues());
    allSuggestions.push(...routingAnalyzer.getSuggestions());

    let shardingMetrics;
    if (this.shardingPlan && this.config.enableShardingAnalysis) {
      const shardingAnalyzer = new ShardingAnalyzer(this.shardingPlan, this.traceEntries, this.writeBatches);
      shardingMetrics = shardingAnalyzer.analyze();
      allIssues.push(...shardingAnalyzer.getIssues());
      allSuggestions.push(...shardingAnalyzer.getSuggestions());
    } else {
      shardingMetrics = {
        shardDistribution: {},
        hotspots: [],
        avgRowsPerShard: 0,
        imbalanceRatio: 0
      };
    }

    const summary = this.generateSummary(allIssues);

    const metrics: AnalysisMetrics = {
      connectionPool: connectionPoolMetrics,
      writePerformance: writePerformanceMetrics,
      indexUsage: indexUsageMetrics,
      slowSQL: slowSQLMetrics,
      routing: routingMetrics,
      sharding: shardingMetrics
    };

    return {
      summary,
      issues: allIssues,
      suggestions: allSuggestions,
      metrics,
      rawData: {
        traceCount: this.traceEntries.length,
        batchCount: this.writeBatches.length,
        tableCount: this.schema.tables.length
      }
    };
  }

  private generateSummary(issues: Issue[]): AnalysisSummary {
    const blockerCount = issues.filter(i => i.severity === 'blocker').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    const canDeploy = blockerCount === 0;

    return {
      canDeploy,
      blockerCount,
      warningCount,
      infoCount
    };
  }
}
