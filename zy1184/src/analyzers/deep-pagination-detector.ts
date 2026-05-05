import { SqlQuery, RequestGroup, Issue, IssueType, IssueSeverity, AnalysisOptions, DEFAULT_ANALYSIS_OPTIONS } from '../models';
import { generateId } from '../utils/id-generator';

export class DeepPaginationDetector {
  private options: AnalysisOptions;

  constructor(options: AnalysisOptions = {}) {
    this.options = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
  }

  detect(requestGroup: RequestGroup): Issue[] {
    const issues: Issue[] = [];

    for (const query of requestGroup.sqlQueries) {
      if (this.isDeepPaginationQuery(query)) {
        const issue = this.createDeepPaginationIssue(query, requestGroup);
        issues.push(issue);
      }
    }

    return issues;
  }

  private isDeepPaginationQuery(query: SqlQuery): boolean {
    if (query.operationType !== 'SELECT') return false;

    const threshold = this.options.deepPaginationThreshold || 1000;

    if (query.offset !== undefined && query.offset >= threshold) {
      return true;
    }

    if (query.limit !== undefined && query.offset !== undefined) {
      const estimatedOffset = query.offset;
      if (estimatedOffset >= threshold) {
        return true;
      }
    }

    const sqlLower = query.sql.toLowerCase();
    const limitOffsetMatch = sqlLower.match(/limit\s+(\d+)\s+offset\s+(\d+)/i);
    if (limitOffsetMatch) {
      const offset = parseInt(limitOffsetMatch[2], 10);
      if (offset >= threshold) {
        return true;
      }
    }

    return false;
  }

  private createDeepPaginationIssue(query: SqlQuery, requestGroup: RequestGroup): Issue {
    const offset = query.offset || 0;
    const limit = query.limit || 0;
    const threshold = this.options.deepPaginationThreshold || 1000;

    const severity: IssueSeverity = offset >= threshold * 10 ? 'CRITICAL' :
                                    offset >= threshold * 5 ? 'HIGH' :
                                    offset >= threshold ? 'MEDIUM' : 'LOW';

    const estimatedCost = this.estimatePaginationCost(offset, limit);

    return {
      id: generateId(),
      type: 'DEEP_PAGINATION',
      severity,
      title: `深分页问题在表 ${query.tableName || 'unknown'}`,
      description: `检测到深分页查询，OFFSET = ${offset}。使用 OFFSET 进行深分页会导致数据库扫描大量不需要的行，性能随着偏移量增加而线性下降。`,
      requestId: requestGroup.requestId,
      queries: [query],
      suggestion: {
        title: '使用游标分页替代 OFFSET 分页',
        description: `将 OFFSET 分页替换为基于游标的分页（Keyset Pagination）。使用上一页最后一条记录的唯一标识作为游标，避免数据库扫描跳过大量行。`,
        codeExample: this.generateCodeExample(query, offset, limit),
        expectedImprovement: {
          queryCountReduction: 0,
          durationReductionPercent: Math.min(90, Math.round((estimatedCost.durationMs / query.duration) * 100) || 50),
          dataTransferReductionPercent: 0,
        },
      },
      impact: {
        queryCountIncrease: 0,
        durationIncreaseMs: estimatedCost.durationMs,
        dataTransferIncreaseBytes: estimatedCost.dataTransferBytes,
      },
      evidence: {
        queries: [query.sql],
        parameters: [
          { offset, limit, threshold, estimatedRowsScanned: estimatedCost.rowsScanned }
        ] as any,
      },
    };
  }

  private estimatePaginationCost(offset: number, limit: number): {
    durationMs: number;
    dataTransferBytes: number;
    rowsScanned: number;
  } {
    const rowsScanned = offset + limit;
    const durationMs = rowsScanned * 0.01;
    const dataTransferBytes = rowsScanned * 50;

    return {
      durationMs,
      dataTransferBytes,
      rowsScanned,
    };
  }

  private generateCodeExample(query: SqlQuery, offset: number, limit: number): string {
    const tableName = query.tableName || 'table_name';
    const orderBy = query.orderBy?.[0] || { column: 'id', direction: 'ASC' };

    return `// 优化前（OFFSET 分页 - 性能问题）
const posts = await Post.findAll({
  order: [[\'${orderBy.column}\', \'${orderBy.direction}\']],
  limit: ${limit},
  offset: ${offset}  // 问题：数据库需要扫描跳过 ${offset} 行
});

// 优化后（游标分页 - 高性能）
// 1. 第一页：不使用游标
const postsPage1 = await Post.findAll({
  order: [[\'${orderBy.column}\', \'${orderBy.direction}\']],
  limit: ${limit}
});

// 2. 后续页：使用上一页最后一条记录的游标
const lastPost = postsPage1[postsPage1.length - 1];
const postsPage2 = await Post.findAll({
  where: {
    ${orderBy.column}: {
      [Op.gt]: lastPost.${orderBy.column}  // 使用游标过滤
    }
  },
  order: [[\'${orderBy.column}\', \'${orderBy.direction}\']],
  limit: ${limit}
});

// 或使用更通用的游标模式
interface PaginationCursor {
  [key: string]: any;
  direction: \'before\' | \'after\';
}

async function paginateWithCursor(
  model: any,
  cursor?: PaginationCursor,
  limit: number = ${limit}
) {
  const where: any = {};
  const order: any[] = [[\'${orderBy.column}\', \'${orderBy.direction}\']];

  if (cursor) {
    const op = cursor.direction === \'after\' ? Op.gt : Op.lt;
    where.${orderBy.column} = { [op]: cursor.${orderBy.column} };
  }

  return model.findAll({
    where,
    order,
    limit: limit + 1  // 多取一条用于判断是否有下一页
  });
}`;
  }
}

export function detectDeepPagination(
  requestGroup: RequestGroup,
  options?: AnalysisOptions
): Issue[] {
  const detector = new DeepPaginationDetector(options);
  return detector.detect(requestGroup);
}
