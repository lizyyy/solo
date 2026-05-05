import { 
  RequestGroup, 
  Issue, 
  Optimization, 
  SimulationResult,
  Comparison,
  TableStructure,
  RepositoryMethodsConfig,
  SimulationOptions,
  DEFAULT_SIMULATION_OPTIONS
} from '../models';
import { generateId } from '../utils/id-generator';
import { simulatePreload } from './preload-simulator';
import { simulateBatchQuery } from './batch-query-simulator';
import { simulateFieldTrimming } from './field-trimming-simulator';
import { simulateCursorPagination } from './cursor-pagination-simulator';

export class QuerySimulator {
  private options: SimulationOptions;
  private tableStructures?: TableStructure[];
  private repositoryMethods?: RepositoryMethodsConfig;

  constructor(
    options: SimulationOptions = {},
    tableStructures?: TableStructure[],
    repositoryMethods?: RepositoryMethodsConfig
  ) {
    this.options = { ...DEFAULT_SIMULATION_OPTIONS, ...options };
    this.tableStructures = tableStructures;
    this.repositoryMethods = repositoryMethods;
  }

  simulate(requestGroup: RequestGroup, issues: Issue[]): SimulationResult {
    const optimizations: Optimization[] = [];

    const preloadOpt = simulatePreload(
      requestGroup, 
      issues, 
      this.options, 
      this.tableStructures, 
      this.repositoryMethods
    );
    if (preloadOpt) optimizations.push(preloadOpt);

    const batchOpt = simulateBatchQuery(
      requestGroup, 
      issues, 
      this.options, 
      this.tableStructures, 
      this.repositoryMethods
    );
    if (batchOpt) optimizations.push(batchOpt);

    const fieldOpt = simulateFieldTrimming(
      requestGroup, 
      issues, 
      this.options, 
      this.tableStructures, 
      this.repositoryMethods
    );
    if (fieldOpt) optimizations.push(fieldOpt);

    const cursorOpt = simulateCursorPagination(
      requestGroup, 
      issues, 
      this.options, 
      this.tableStructures, 
      this.repositoryMethods
    );
    if (cursorOpt) optimizations.push(cursorOpt);

    const comparison = this.createComparison(requestGroup, optimizations);

    return {
      requestId: requestGroup.requestId,
      originalRequestGroup: requestGroup,
      optimizations,
      comparison,
      simulationTime: new Date(),
    };
  }

  simulateBatch(requestGroups: RequestGroup[], issuesMap: Map<string, Issue[]>): SimulationResult[] {
    const results: SimulationResult[] = [];

    for (const group of requestGroups) {
      const issues = issuesMap.get(group.requestId) || [];
      results.push(this.simulate(group, issues));
    }

    return results;
  }

  private createComparison(
    requestGroup: RequestGroup, 
    optimizations: Optimization[]
  ): Comparison {
    const originalQueryCount = requestGroup.totalQueryCount;
    const originalDuration = requestGroup.totalQueryDuration;
    const originalDataTransfer = originalQueryCount * 150;

    let optimizedQueryCount = originalQueryCount;
    let optimizedDuration = originalDuration;
    let optimizedDataTransfer = originalDataTransfer;

    for (const opt of optimizations) {
      optimizedQueryCount += opt.impact.queryCountChange;
      optimizedDuration += opt.impact.durationChangeMs;
      optimizedDataTransfer += opt.impact.dataTransferChangeBytes;
    }

    optimizedQueryCount = Math.max(1, optimizedQueryCount);
    optimizedDuration = Math.max(0, optimizedDuration);
    optimizedDataTransfer = Math.max(0, optimizedDataTransfer);

    const queryCountReduction = originalQueryCount - optimizedQueryCount;
    const durationReductionMs = originalDuration - optimizedDuration;
    const dataTransferReductionBytes = originalDataTransfer - optimizedDataTransfer;

    return {
      original: {
        totalRequests: 1,
        totalQueries: originalQueryCount,
        totalDurationMs: originalDuration,
        totalDataTransferBytes: originalDataTransfer,
        avgQueriesPerRequest: originalQueryCount,
        avgDurationPerRequest: originalDuration,
      },
      optimized: {
        totalRequests: 1,
        totalQueries: optimizedQueryCount,
        totalDurationMs: optimizedDuration,
        totalDataTransferBytes: optimizedDataTransfer,
        avgQueriesPerRequest: optimizedQueryCount,
        avgDurationPerRequest: optimizedDuration,
      },
      improvement: {
        queryCountReduction,
        queryCountReductionPercent: originalQueryCount > 0 
          ? Math.round((queryCountReduction / originalQueryCount) * 100) 
          : 0,
        durationReductionMs,
        durationReductionPercent: originalDuration > 0 
          ? Math.round((durationReductionMs / originalDuration) * 100) 
          : 0,
        dataTransferReductionBytes,
        dataTransferReductionPercent: originalDataTransfer > 0 
          ? Math.round((dataTransferReductionBytes / originalDataTransfer) * 100) 
          : 0,
      },
    };
  }

  static simulate(
    requestGroup: RequestGroup,
    issues: Issue[],
    options?: SimulationOptions,
    tableStructures?: TableStructure[],
    repositoryMethods?: RepositoryMethodsConfig
  ): SimulationResult {
    const simulator = new QuerySimulator(options, tableStructures, repositoryMethods);
    return simulator.simulate(requestGroup, issues);
  }

  static simulateBatch(
    requestGroups: RequestGroup[],
    issuesMap: Map<string, Issue[]>,
    options?: SimulationOptions,
    tableStructures?: TableStructure[],
    repositoryMethods?: RepositoryMethodsConfig
  ): SimulationResult[] {
    const simulator = new QuerySimulator(options, tableStructures, repositoryMethods);
    return simulator.simulateBatch(requestGroups, issuesMap);
  }
}

export function simulateQuery(
  requestGroup: RequestGroup,
  issues: Issue[],
  options?: SimulationOptions,
  tableStructures?: TableStructure[],
  repositoryMethods?: RepositoryMethodsConfig
): SimulationResult {
  return QuerySimulator.simulate(requestGroup, issues, options, tableStructures, repositoryMethods);
}

export function simulateQueriesBatch(
  requestGroups: RequestGroup[],
  issuesMap: Map<string, Issue[]>,
  options?: SimulationOptions,
  tableStructures?: TableStructure[],
  repositoryMethods?: RepositoryMethodsConfig
): SimulationResult[] {
  return QuerySimulator.simulateBatch(requestGroups, issuesMap, options, tableStructures, repositoryMethods);
}
