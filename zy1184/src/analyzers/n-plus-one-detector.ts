import { SqlQuery, RequestGroup, Issue, IssueType, IssueSeverity, AnalysisOptions, DEFAULT_ANALYSIS_OPTIONS } from '../models';
import { generateId, generateDeterministicId } from '../utils/id-generator';

export class NPlusOneDetector {
  private options: AnalysisOptions;

  constructor(options: AnalysisOptions = {}) {
    this.options = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };
  }

  detect(requestGroup: RequestGroup): Issue[] {
    const issues: Issue[] = [];

    const nPlusOneIssues = this.detectNPlusOnePattern(requestGroup);
    issues.push(...nPlusOneIssues);

    return issues;
  }

  private detectNPlusOnePattern(requestGroup: RequestGroup): Issue[] {
    const issues: Issue[] = [];
    const queries = requestGroup.sqlQueries;

    if (queries.length < 2) return issues;

    const patterns = this.findNPlusOnePatterns(queries);

    for (const pattern of patterns) {
      if (pattern.queries.length >= (this.options.nPlus1Threshold || 3)) {
        const issue = this.createNPlusOneIssue(pattern, requestGroup);
        issues.push(issue);
      }
    }

    return issues;
  }

  private findNPlusOnePatterns(queries: SqlQuery[]): NPlusOnePattern[] {
    const patterns: NPlusOnePattern[] = [];
    const patternMap = new Map<string, NPlusOnePattern>();

    const selectQueries = queries.filter(q => q.operationType === 'SELECT');

    for (let i = 0; i < selectQueries.length; i++) {
      const query = selectQueries[i];
      
      const patternKey = this.generatePatternKey(query);
      
      const isIdLookup = this.isIdLookupQuery(query);
      
      if (isIdLookup) {
        if (!patternMap.has(patternKey)) {
          patternMap.set(patternKey, {
            key: patternKey,
            tableName: query.tableName || 'unknown',
            queries: [],
            parameterValues: new Set(),
          });
        }
        
        const pattern = patternMap.get(patternKey)!;
        pattern.queries.push(query);
        
        for (const clause of query.whereClauses) {
          if (clause.value !== null && clause.value !== undefined) {
            pattern.parameterValues.add(String(clause.value));
          }
        }
      }
    }

    for (const pattern of patternMap.values()) {
      if (pattern.queries.length >= (this.options.nPlus1Threshold || 3)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  private generatePatternKey(query: SqlQuery): string {
    const parts: string[] = [];
    parts.push(query.tableName || 'unknown');
    parts.push(query.normalizedSql);
    
    return generateDeterministicId(...parts);
  }

  private isIdLookupQuery(query: SqlQuery): boolean {
    if (query.operationType !== 'SELECT') return false;

    const whereClauses = query.whereClauses;
    if (whereClauses.length === 0) return false;

    const idColumns = ['id', 'user_id', 'userId', 'post_id', 'postId', 'comment_id', 'commentId', 'author_id', 'authorId'];
    
    for (const clause of whereClauses) {
      const columnLower = clause.column.toLowerCase();
      const isIdColumn = idColumns.some(id => columnLower === id.toLowerCase() || columnLower.endsWith('_id'));
      
      if (isIdColumn && (clause.operator === '=' || clause.operator === 'IN')) {
        return true;
      }
    }

    return false;
  }

  private createNPlusOneIssue(pattern: NPlusOnePattern, requestGroup: RequestGroup): Issue {
    const queryCount = pattern.queries.length;
    const totalDuration = pattern.queries.reduce((sum, q) => sum + q.duration, 0);

    const severity: IssueSeverity = queryCount >= 10 ? 'CRITICAL' : 
                                    queryCount >= 5 ? 'HIGH' : 'MEDIUM';

    const estimatedDataTransfer = pattern.queries.length * 200;

    return {
      id: generateId(),
      type: 'N_PLUS_1',
      severity,
      title: `N+1 查询问题在表 ${pattern.tableName}`,
      description: `检测到 ${queryCount} 个类似的查询在同一次请求中执行，这是典型的 N+1 问题。每次查询通过 ID 查找单个记录，但可以通过批量查询或预加载优化。`,
      requestId: requestGroup.requestId,
      queries: pattern.queries,
      suggestion: {
        title: '使用批量查询或预加载',
        description: `将 ${queryCount} 个单独查询替换为 1 个批量查询。使用 WHERE IN (?) 或 ORM 的预加载功能。`,
        codeExample: this.generateCodeExample(pattern),
        expectedImprovement: {
          queryCountReduction: queryCount - 1,
          durationReductionPercent: Math.round((totalDuration * 0.7) / totalDuration * 100),
          dataTransferReductionPercent: 30,
        },
      },
      impact: {
        queryCountIncrease: queryCount - 1,
        durationIncreaseMs: totalDuration * 0.7,
        dataTransferIncreaseBytes: estimatedDataTransfer,
      },
      evidence: {
        queries: pattern.queries.map(q => q.sql),
        parameters: Array.from(pattern.parameterValues),
      },
    };
  }

  private generateCodeExample(pattern: NPlusOnePattern): string {
    const tableName = pattern.tableName;
    const paramCount = pattern.parameterValues.size;

    return `// 优化前（N+1 查询）
const posts = await Post.findAll({ where: { authorId: authorIds } });
for (const post of posts) {
  const author = await Author.findOne({ where: { id: post.authorId } });
  post.author = author;
}

// 优化后（批量查询）
const posts = await Post.findAll({ where: { authorId: authorIds } });
const authorIds = posts.map(p => p.authorId);
const authors = await Author.findAll({ 
  where: { id: authorIds } 
});
const authorMap = new Map(authors.map(a => [a.id, a]));
for (const post of posts) {
  post.author = authorMap.get(post.authorId);
}

// 或使用预加载（如果 ORM 支持）
const posts = await Post.findAll({
  where: { authorId: authorIds },
  include: [{ model: Author }]
});`;
  }
}

interface NPlusOnePattern {
  key: string;
  tableName: string;
  queries: SqlQuery[];
  parameterValues: Set<string>;
}

export function detectNPlusOne(
  requestGroup: RequestGroup,
  options?: AnalysisOptions
): Issue[] {
  const detector = new NPlusOneDetector(options);
  return detector.detect(requestGroup);
}
