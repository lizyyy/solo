import { QueryAnalyzer, analyzeQuery, analyzeQueriesBatch } from '../src/analyzers';
import { detectNPlusOne } from '../src/analyzers/n-plus-one-detector';
import { detectDuplicateQueries } from '../src/analyzers/duplicate-query-detector';
import { detectDeepPagination } from '../src/analyzers/deep-pagination-detector';
import { detectSlowQueries } from '../src/analyzers/slow-query-detector';
import { RequestGroup, SqlQuery, Issue, AnalysisOptions, DEFAULT_ANALYSIS_OPTIONS } from '../src/models';
import { generateId } from '../src/utils/id-generator';

describe('analyzers', () => {
  function createMockSqlQuery(overrides: Partial<SqlQuery> = {}): SqlQuery {
    return {
      id: generateId(),
      requestId: 'req_001',
      timestamp: new Date(),
      sql: 'SELECT * FROM test',
      normalizedSql: 'SELECT * FROM test',
      parameters: [],
      duration: 10,
      operationType: 'SELECT',
      joinTables: [],
      whereClauses: [],
      selectFields: [],
      ...overrides,
    };
  }

  function createMockRequestGroup(overrides: Partial<RequestGroup> = {}): RequestGroup {
    const now = new Date();
    return {
      requestId: 'req_001',
      sqlQueries: [],
      startTime: now,
      endTime: now,
      totalDuration: 100,
      totalQueryCount: 0,
      totalQueryDuration: 0,
      queryByTable: {},
      queryByOperation: {},
      metadata: {},
      ...overrides,
    };
  }

  describe('n-plus-one-detector', () => {
    it('should detect N+1 pattern with similar queries', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          sql: 'SELECT * FROM comments WHERE post_id = 1',
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          sql: 'SELECT * FROM comments WHERE post_id = 2',
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          sql: 'SELECT * FROM comments WHERE post_id = 3',
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          sql: 'SELECT * FROM comments WHERE post_id = 4',
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectNPlusOne(group, { nPlus1Threshold: 3 });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('N_PLUS_1');
      expect(issues[0].queries.length).toBeGreaterThanOrEqual(3);
    });

    it('should not detect N+1 for fewer than threshold queries', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectNPlusOne(group, { nPlus1Threshold: 3 });

      expect(issues.length).toBe(0);
    });

    it('should identify ID lookup queries correctly', () => {
      const idQueries: SqlQuery[] = [
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
        createMockSqlQuery({
          tableName: 'comments',
          whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: idQueries,
        totalQueryCount: idQueries.length,
      });

      const issues = detectNPlusOne(group, { nPlus1Threshold: 3 });

      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('duplicate-query-detector', () => {
    it('should detect duplicate queries within time window', () => {
      const now = Date.now();
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          timestamp: new Date(now),
          normalizedSql: 'SELECT * FROM users WHERE id = ?',
          sql: 'SELECT * FROM users WHERE id = 1',
        }),
        createMockSqlQuery({
          timestamp: new Date(now + 100),
          normalizedSql: 'SELECT * FROM users WHERE id = ?',
          sql: 'SELECT * FROM users WHERE id = 1',
        }),
        createMockSqlQuery({
          timestamp: new Date(now + 200),
          normalizedSql: 'SELECT * FROM users WHERE id = ?',
          sql: 'SELECT * FROM users WHERE id = 1',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectDuplicateQueries(group, { duplicateQueryTimeWindowMs: 1000 });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('DUPLICATE_QUERY');
      expect(issues[0].queries.length).toBe(3);
    });

    it('should not detect duplicates outside time window', () => {
      const now = Date.now();
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          timestamp: new Date(now),
          normalizedSql: 'SELECT * FROM users WHERE id = ?',
        }),
        createMockSqlQuery({
          timestamp: new Date(now + 2000),
          normalizedSql: 'SELECT * FROM users WHERE id = ?',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectDuplicateQueries(group, { duplicateQueryTimeWindowMs: 1000 });

      expect(issues.length).toBe(0);
    });

    it('should set severity based on duplicate count', () => {
      const now = Date.now();
      const manyDuplicates: SqlQuery[] = Array.from({ length: 12 }, (_, i) =>
        createMockSqlQuery({
          timestamp: new Date(now + i * 50),
          normalizedSql: 'SELECT * FROM test',
        })
      );

      const group = createMockRequestGroup({
        sqlQueries: manyDuplicates,
        totalQueryCount: manyDuplicates.length,
      });

      const issues = detectDuplicateQueries(group, { duplicateQueryTimeWindowMs: 5000 });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe('CRITICAL');
    });
  });

  describe('deep-pagination-detector', () => {
    it('should detect deep pagination with large offset', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          limit: 20,
          offset: 1980,
          sql: 'SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 1980',
          duration: 150,
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectDeepPagination(group, { deepPaginationThreshold: 1000 });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('DEEP_PAGINATION');
    });

    it('should not detect deep pagination for small offset', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          limit: 20,
          offset: 50,
          sql: 'SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 50',
          duration: 50,
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectDeepPagination(group, { deepPaginationThreshold: 1000 });

      expect(issues.length).toBe(0);
    });

    it('should set severity based on offset size', () => {
      const largeOffsetQuery = createMockSqlQuery({
        limit: 20,
        offset: 6000,
        sql: 'SELECT * FROM posts ORDER BY created_at DESC LIMIT 20 OFFSET 6000',
        duration: 500,
      });

      const group = createMockRequestGroup({
        sqlQueries: [largeOffsetQuery],
        totalQueryCount: 1,
      });

      const issues = detectDeepPagination(group, { deepPaginationThreshold: 1000 });

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe('HIGH');
    });
  });

  describe('slow-query-detector', () => {
    it('should detect slow queries above threshold', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          duration: 250,
          sql: 'SELECT * FROM large_table WHERE unindexed_column = ?',
        }),
        createMockSqlQuery({
          duration: 50,
          sql: 'SELECT * FROM small_table WHERE id = ?',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
      });

      const issues = detectSlowQueries(group, { slowQueryThresholdMs: 100 });

      expect(issues.length).toBe(1);
      expect(issues[0].type).toBe('SLOW_QUERY');
      expect(issues[0].queries[0].duration).toBe(250);
    });

    it('should set severity based on duration', () => {
      const criticalQuery = createMockSqlQuery({
        duration: 5000,
        sql: 'SELECT * FROM huge_table',
      });

      const highQuery = createMockSqlQuery({
        duration: 500,
        sql: 'SELECT * FROM large_table',
      });

      const group = createMockRequestGroup({
        sqlQueries: [criticalQuery, highQuery],
        totalQueryCount: 2,
      });

      const issues = detectSlowQueries(group, { slowQueryThresholdMs: 100 });

      expect(issues.length).toBe(2);
      expect(issues.some(i => i.severity === 'CRITICAL')).toBe(true);
      expect(issues.some(i => i.severity === 'HIGH')).toBe(true);
    });
  });

  describe('QueryAnalyzer', () => {
    it('should analyze a single request group', () => {
      const queries: SqlQuery[] = [
        createMockSqlQuery({
          duration: 5,
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
          whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          tableName: 'comments',
        }),
        createMockSqlQuery({
          duration: 6,
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
          whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          tableName: 'comments',
        }),
        createMockSqlQuery({
          duration: 7,
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
          whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          tableName: 'comments',
        }),
        createMockSqlQuery({
          duration: 8,
          normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
          whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          tableName: 'comments',
        }),
      ];

      const group = createMockRequestGroup({
        sqlQueries: queries,
        totalQueryCount: queries.length,
        totalQueryDuration: queries.reduce((sum, q) => sum + q.duration, 0),
      });

      const analyzer = new QueryAnalyzer({ nPlus1Threshold: 3 });
      const result = analyzer.analyze(group);

      expect(result.requestId).toBe(group.requestId);
      expect(result.requestGroup).toBe(group);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.analysisTime).toBeDefined();
    });

    it('should analyze multiple request groups in batch', () => {
      const group1 = createMockRequestGroup({
        requestId: 'req_001',
        sqlQueries: [
          createMockSqlQuery({
            duration: 5,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 6,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 7,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 8,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          }),
        ],
        totalQueryCount: 4,
      });

      const group2 = createMockRequestGroup({
        requestId: 'req_002',
        sqlQueries: [
          createMockSqlQuery({ duration: 150, sql: 'SELECT * FROM large_table' }),
        ],
        totalQueryCount: 1,
      });

      const analyzer = new QueryAnalyzer({ nPlus1Threshold: 3, slowQueryThresholdMs: 100 });
      const results = analyzer.analyzeBatch([group1, group2]);

      expect(results.length).toBe(2);
      expect(results[0].requestId).toBe('req_001');
      expect(results[1].requestId).toBe('req_002');
    });

    it('should respect analysis options', () => {
      const group = createMockRequestGroup({
        sqlQueries: [
          createMockSqlQuery({
            duration: 5,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 6,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 7,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 8,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          }),
        ],
        totalQueryCount: 4,
      });

      const analyzerWithNPlus1 = new QueryAnalyzer({ checkNPlus1: true, nPlus1Threshold: 3 });
      const resultWithNPlus1 = analyzerWithNPlus1.analyze(group);

      const analyzerWithoutNPlus1 = new QueryAnalyzer({ checkNPlus1: false });
      const resultWithoutNPlus1 = analyzerWithoutNPlus1.analyze(group);

      expect(resultWithNPlus1.issues.some(i => i.type === 'N_PLUS_1')).toBe(true);
      expect(resultWithoutNPlus1.issues.some(i => i.type === 'N_PLUS_1')).toBe(false);
    });

    it('should generate summary with statistics', () => {
      const group = createMockRequestGroup({
        sqlQueries: [
          createMockSqlQuery({
            duration: 5,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 6,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 7,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 8,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          }),
        ],
        totalQueryCount: 4,
      });

      const analyzer = new QueryAnalyzer({ nPlus1Threshold: 3 });
      const result = analyzer.analyze(group);

      expect(result.summary).toBeDefined();
      expect(result.summary.totalRequests).toBeGreaterThan(0);
      expect(result.summary.totalQueries).toBe(4);
      expect(result.summary.totalIssues).toBeGreaterThan(0);
      expect(result.summary.issuesByType).toBeDefined();
      expect(result.summary.issuesBySeverity).toBeDefined();
    });
  });

  describe('convenience functions', () => {
    it('analyzeQuery should work as convenience function', () => {
      const group = createMockRequestGroup({
        sqlQueries: [
          createMockSqlQuery({
            duration: 5,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 6,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 7,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 8,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          }),
        ],
        totalQueryCount: 4,
      });

      const result = analyzeQuery(group, { nPlus1Threshold: 3 });

      expect(result).toBeDefined();
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('analyzeQueriesBatch should work as convenience function', () => {
      const group1 = createMockRequestGroup({
        requestId: 'req_001',
        sqlQueries: [
          createMockSqlQuery({
            duration: 5,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 1, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 6,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 2, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 7,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 3, isParameter: true }],
          }),
          createMockSqlQuery({
            duration: 8,
            normalizedSql: 'SELECT * FROM comments WHERE post_id = ?',
            whereClauses: [{ column: 'post_id', operator: '=', value: 4, isParameter: true }],
          }),
        ],
        totalQueryCount: 4,
      });

      const results = analyzeQueriesBatch([group1], { nPlus1Threshold: 3 });

      expect(results.length).toBe(1);
    });
  });
});
