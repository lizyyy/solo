import { SqlQuery, RequestGroup, Issue, IssueType, IssueSeverity, AnalysisOptions, DEFAULT_ANALYSIS_OPTIONS, TableStructure, IndexDefinition } from '../models';
import { generateId } from '../utils/id-generator';

export class SlowQueryDetector {
  private options: AnalysisOptions;
  private tableStructures?: TableStructure[];

  constructor(options: AnalysisOptions = {}, tableStructures?: TableStructure[]) {
    this.options = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
    this.tableStructures = tableStructures;
  }

  detect(requestGroup: RequestGroup): Issue[] {
    const issues: Issue[] = [];

    for (const query of requestGroup.sqlQueries) {
      if (this.isSlowQuery(query)) {
        const issue = this.createSlowQueryIssue(query, requestGroup);
        issues.push(issue);
      }
    }

    return issues;
  }

  private isSlowQuery(query: SqlQuery): boolean {
    const threshold = this.options.slowQueryThresholdMs || 100;
    return query.duration >= threshold;
  }

  private createSlowQueryIssue(query: SqlQuery, requestGroup: RequestGroup): Issue {
    const threshold = this.options.slowQueryThresholdMs || 100;
    const duration = query.duration;
    const severity: IssueSeverity = duration >= threshold * 10 ? 'CRITICAL' :
                                    duration >= threshold * 5 ? 'HIGH' :
                                    duration >= threshold * 2 ? 'MEDIUM' : 'LOW';

    const analysis = this.analyzeSlowQuery(query);

    return {
      id: generateId(),
      type: 'SLOW_QUERY',
      severity,
      title: `慢查询在表 ${query.tableName || 'unknown'}`,
      description: `查询耗时 ${duration}ms，超过阈值 ${threshold}ms。${analysis.reason || '需要进一步分析慢查询原因。'}`,
      requestId: requestGroup.requestId,
      queries: [query],
      suggestion: {
        title: analysis.suggestion?.title || '优化慢查询',
        description: analysis.suggestion?.description || this.getDefaultSuggestion(query),
        codeExample: analysis.suggestion?.codeExample,
        expectedImprovement: {
          queryCountReduction: 0,
          durationReductionPercent: 50,
          dataTransferReductionPercent: 20,
        },
      },
      impact: {
        queryCountIncrease: 0,
        durationIncreaseMs: duration - threshold,
        dataTransferIncreaseBytes: analysis.estimatedDataTransfer,
      },
      evidence: {
        queries: [query.sql],
        parameters: [
          {
            duration,
            threshold,
            operationType: query.operationType,
            tableName: query.tableName,
            rowsAffected: query.rowsAffected,
            whereClauses: query.whereClauses.map(c => `${c.column} ${c.operator} ${c.value}`),
            missingIndex: analysis.missingIndex,
            fullTableScan: analysis.fullTableScan,
          }
        ] as any,
      },
    };
  }

  private analyzeSlowQuery(query: SqlQuery): {
    reason?: string;
    suggestion?: {
      title: string;
      description: string;
      codeExample?: string;
    };
    missingIndex: boolean;
    fullTableScan: boolean;
    estimatedDataTransfer: number;
  } {
    const result = {
      missingIndex: false,
      fullTableScan: false,
      estimatedDataTransfer: 0,
      reason: '',
      suggestion: undefined as { title: string; description: string; codeExample?: string } | undefined,
    };

    result.estimatedDataTransfer = (query.rowsAffected || 100) * 100;

    if (query.operationType === 'SELECT') {
      const hasWhereClause = query.whereClauses.length > 0;
      
      if (hasWhereClause && this.tableStructures) {
        const table = this.tableStructures.find(t => t.tableName === query.tableName);
        if (table) {
          const whereColumns = query.whereClauses.map(c => c.column.toLowerCase());
          const indexedColumns = this.getAllIndexedColumns(table);
          
          const hasMatchingIndex = whereColumns.some(col => 
            indexedColumns.has(col)
          );

          if (!hasMatchingIndex && whereColumns.length > 0) {
            result.missingIndex = true;
            result.reason = `查询条件中的列 (${whereColumns.join(', ')}) 没有可用的索引，可能导致全表扫描。`;
            result.suggestion = {
              title: '添加适当的索引',
              description: `为查询条件中使用的列添加索引可以显著提升查询性能。建议检查执行计划，确认是否需要创建复合索引。`,
              codeExample: this.generateIndexExample(query, whereColumns),
            };
          }
        }
      }

      if (query.selectFields.includes('*')) {
        result.fullTableScan = true;
        if (!result.reason) {
          result.reason = `使用 SELECT * 可能导致不必要的数据传输和磁盘 I/O。`;
          result.suggestion = {
            title: '明确指定需要的字段',
            description: `只选择实际需要的字段，避免使用 SELECT *。这样可以减少数据传输量，提高查询效率。`,
          };
        }
      }

      if (query.limit === undefined && query.rowsAffected && query.rowsAffected > 1000) {
        if (!result.reason) {
          result.reason = `查询返回了 ${query.rowsAffected} 行数据，可能没有使用分页。`;
          result.suggestion = {
            title: '添加分页限制',
            description: `对大结果集使用分页，避免一次性加载过多数据。使用 LIMIT 和 OFFSET 或游标分页。`,
          };
        }
      }

      if (query.joinTables && query.joinTables.length > 0) {
        if (!result.reason) {
          result.reason = `查询涉及 ${query.joinTables.length} 个表的 JOIN 操作，可能需要优化 JOIN 条件或添加索引。`;
          result.suggestion = {
            title: '优化 JOIN 操作',
            description: `确保 JOIN 条件中的列有适当的索引。考虑是否可以使用预加载或分批查询来替代复杂的多表 JOIN。`,
          };
        }
      }
    }

    if (query.operationType === 'UPDATE' || query.operationType === 'DELETE') {
      const hasWhereClause = query.whereClauses.length > 0;
      
      if (!hasWhereClause) {
        result.fullTableScan = true;
        result.reason = `${query.operationType} 操作没有 WHERE 子句，将影响所有行。`;
        result.suggestion = {
          title: '添加 WHERE 条件',
          description: `确保 ${query.operationType} 操作有适当的 WHERE 条件，避免误操作影响所有数据。`,
        };
      }
    }

    if (!result.reason) {
      result.reason = '慢查询可能由多种原因导致，建议检查执行计划、索引使用情况和服务器负载。';
    }

    return result;
  }

  private getAllIndexedColumns(table: TableStructure): Set<string> {
    const columns = new Set<string>();

    if (table.primaryKey) {
      for (const col of table.primaryKey.columns) {
        columns.add(col.toLowerCase());
      }
    }

    for (const index of table.indexes) {
      for (const col of index.columns) {
        columns.add(col.toLowerCase());
      }
    }

    return columns;
  }

  private generateIndexExample(query: SqlQuery, whereColumns: string[]): string {
    const tableName = query.tableName || 'table_name';
    const indexColumns = whereColumns.slice(0, 3).join(', ');
    const indexName = `idx_${tableName}_${whereColumns.slice(0, 2).join('_')}`;

    return `-- 为查询条件添加索引
CREATE INDEX ${indexName} 
ON ${tableName} (${indexColumns});

-- 或创建复合索引（如果查询条件使用多个列）
CREATE INDEX ${indexName}_composite 
ON ${tableName} (${whereColumns.join(', ')});

-- 检查现有索引
SHOW INDEX FROM ${tableName};

-- 分析查询执行计划（MySQL）
EXPLAIN ${query.sql};

-- 分析查询执行计划（PostgreSQL）
EXPLAIN ANALYZE ${query.sql};`;
  }

  private getDefaultSuggestion(query: SqlQuery): string {
    return `慢查询优化建议：
1. 检查查询执行计划，确认索引使用情况
2. 确保 WHERE 条件中的列有适当的索引
3. 避免使用 SELECT *，只选择需要的字段
4. 对大结果集使用分页
5. 考虑优化 JOIN 操作
6. 检查是否存在锁竞争或服务器资源问题`;
  }
}

export function detectSlowQueries(
  requestGroup: RequestGroup,
  options?: AnalysisOptions,
  tableStructures?: TableStructure[]
): Issue[] {
  const detector = new SlowQueryDetector(options, tableStructures);
  return detector.detect(requestGroup);
}
