import { 
  SqlQuery, 
  RequestGroup, 
  Issue, 
  Optimization, 
  OptimizedQuery, 
  TableStructure,
  RepositoryMethodsConfig,
  SimulationOptions,
  DEFAULT_SIMULATION_OPTIONS
} from '../models';
import { generateId } from '../utils/id-generator';

export class CursorPaginationSimulator {
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

  simulate(requestGroup: RequestGroup, issues: Issue[]): Optimization | null {
    if (!this.options.simulateCursorPagination) return null;

    const deepPaginationIssues = issues.filter(i => i.type === 'DEEP_PAGINATION');
    
    if (deepPaginationIssues.length === 0) return null;

    const allQueries: SqlQuery[] = [];
    for (const issue of deepPaginationIssues) {
      allQueries.push(...issue.queries);
    }

    if (allQueries.length === 0) return null;

    const optimizedQueries: OptimizedQuery[] = [];
    let totalOriginalDuration = 0;
    let totalOriginalQueries = allQueries.length;

    for (const query of allQueries) {
      totalOriginalDuration += query.duration;

      const optimizedQuery = this.createOptimizedQuery(query);
      optimizedQueries.push(optimizedQuery);
    }

    const optimizedDuration = optimizedQueries.reduce((sum, q) => sum + q.estimatedDuration, 0);
    const originalDataTransfer = this.estimateDataTransfer(allQueries);
    const optimizedDataTransfer = this.estimateOptimizedDataTransfer(optimizedQueries);

    return {
      id: generateId(),
      type: 'CURSOR_PAGINATION',
      title: '使用游标分页替代 OFFSET 分页',
      description: `检测到 ${allQueries.length} 个深分页查询，OFFSET 范围从 ${this.getMinOffset(allQueries)} 到 ${this.getMaxOffset(allQueries)}。使用游标分页可以避免数据库扫描大量行。`,
      targetIssues: deepPaginationIssues.map(i => i.id),
      originalQueries: allQueries,
      optimizedQueries,
      impact: {
        queryCountChange: 0,
        queryCountChangePercent: 0,
        durationChangeMs: -(totalOriginalDuration - optimizedDuration),
        durationChangePercent: Math.round((1 - optimizedDuration / totalOriginalDuration) * 100),
        dataTransferChangeBytes: -(originalDataTransfer - optimizedDataTransfer),
        dataTransferChangePercent: Math.round((1 - optimizedDataTransfer / originalDataTransfer) * 100),
      },
      before: {
        queryCount: totalOriginalQueries,
        totalDurationMs: totalOriginalDuration,
        totalDataTransferBytes: originalDataTransfer,
        queries: allQueries.map(q => ({
          sql: q.sql,
          duration: q.duration,
          dataTransferBytes: this.estimateQueryDataTransfer(q),
        })),
      },
      after: {
        queryCount: optimizedQueries.length,
        totalDurationMs: optimizedDuration,
        totalDataTransferBytes: optimizedDataTransfer,
        queries: optimizedQueries.map(q => ({
          sql: q.sql,
          duration: q.estimatedDuration,
          dataTransferBytes: q.estimatedRows * 50,
        })),
      },
    };
  }

  private getMinOffset(queries: SqlQuery[]): number {
    const offsets = queries.map(q => q.offset || 0).filter(o => o > 0);
    return offsets.length > 0 ? Math.min(...offsets) : 0;
  }

  private getMaxOffset(queries: SqlQuery[]): number {
    const offsets = queries.map(q => q.offset || 0);
    return Math.max(...offsets);
  }

  private estimateDataTransfer(queries: SqlQuery[]): number {
    return queries.reduce((sum, q) => sum + this.estimateQueryDataTransfer(q), 0);
  }

  private estimateQueryDataTransfer(query: SqlQuery): number {
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    const rowsScanned = offset + limit;
    const fieldCount = query.selectFields.includes('*') ? 20 : query.selectFields.length;
    
    return rowsScanned * fieldCount * 50;
  }

  private estimateOptimizedDataTransfer(queries: OptimizedQuery[]): number {
    return queries.reduce((sum, q) => sum + q.estimatedRows * 3 * 50, 0);
  }

  private createOptimizedQuery(query: SqlQuery): OptimizedQuery {
    const table = query.tableName || 'table';
    const limit = query.limit || 10;
    const offset = query.offset || 0;

    const orderByColumn = this.getOrderByColumn(query);
    const cursorValue = this.estimateCursorValue(query, orderByColumn);

    const selectFields = query.selectFields.includes('*') 
      ? 'id, name, created_at' 
      : query.selectFields.slice(0, 5).join(', ');

    const sql = `SELECT ${selectFields} FROM ${table} WHERE ${orderByColumn} > ? ORDER BY ${orderByColumn} ASC LIMIT ${limit}`;

    const originalCost = this.estimateQueryCost(query);
    const optimizedCost = this.estimateCursorCost(query);

    const costRatio = optimizedCost / originalCost;
    const estimatedDuration = query.duration * (0.1 + costRatio * 0.3);

    return {
      sql,
      normalizedSql: sql,
      parameters: [cursorValue],
      estimatedDuration,
      estimatedRows: limit,
      explanation: `将 OFFSET ${offset} 替换为游标分页。原查询需要扫描 ${offset + limit} 行，游标分页只需要扫描 ${limit} 行并利用索引定位。`,
    };
  }

  private getOrderByColumn(query: SqlQuery): string {
    if (query.orderBy && query.orderBy.length > 0) {
      return query.orderBy[0].column;
    }
    return 'id';
  }

  private estimateCursorValue(query: SqlQuery, orderByColumn: string): any {
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    const pageNumber = Math.floor(offset / limit) + 1;

    if (orderByColumn.toLowerCase() === 'id') {
      return offset + 1;
    }

    if (orderByColumn.toLowerCase().includes('created') || 
        orderByColumn.toLowerCase().includes('updated') ||
        orderByColumn.toLowerCase().includes('time')) {
      const baseTime = Date.now() - (pageNumber * limit * 60000);
      return new Date(baseTime).toISOString();
    }

    return `cursor_value_${pageNumber}`;
  }

  private estimateQueryCost(query: SqlQuery): number {
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    return offset + limit;
  }

  private estimateCursorCost(query: SqlQuery): number {
    const limit = query.limit || 10;
    return limit * 0.5;
  }
}

export function simulateCursorPagination(
  requestGroup: RequestGroup,
  issues: Issue[],
  options?: SimulationOptions,
  tableStructures?: TableStructure[],
  repositoryMethods?: RepositoryMethodsConfig
): Optimization | null {
  const simulator = new CursorPaginationSimulator(options, tableStructures, repositoryMethods);
  return simulator.simulate(requestGroup, issues);
}
