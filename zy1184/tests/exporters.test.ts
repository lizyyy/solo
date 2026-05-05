import { exportMarkdown, exportJson, exportCsv, exportReport, exportReportsBatch } from '../src/exporters';
import { AnalysisResult, Issue, IssueType, IssueSeverity, RequestGroup, SqlQuery, SimulationResult } from '../src/models';
import { generateId } from '../src/utils/id-generator';

describe('exporters', () => {
  function createMockIssue(overrides: Partial<Issue> = {}): Issue {
    return {
      id: generateId(),
      type: 'N_PLUS_1' as IssueType,
      severity: 'HIGH' as IssueSeverity,
      title: 'Test N+1 Issue',
      description: 'This is a test N+1 query issue',
      requestId: 'req_001',
      queries: [],
      suggestion: {
        title: 'Use batch query',
        description: 'Replace multiple queries with a single batch query',
        codeExample: 'const items = await Model.findAll({ where: { id: ids } });',
        expectedImprovement: {
          queryCountReduction: 3,
          durationReductionPercent: 70,
          dataTransferReductionPercent: 30,
        },
      },
      impact: {
        queryCountIncrease: 3,
        durationIncreaseMs: 150,
        dataTransferIncreaseBytes: 500,
      },
      evidence: {
        queries: [
          'SELECT * FROM comments WHERE post_id = 1',
          'SELECT * FROM comments WHERE post_id = 2',
          'SELECT * FROM comments WHERE post_id = 3',
        ],
      },
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
      totalDuration: 250,
      totalQueryCount: 10,
      totalQueryDuration: 150,
      queryByTable: { users: [], posts: [], comments: [] },
      queryByOperation: { SELECT: [] },
      metadata: {},
      ...overrides,
    };
  }

  function createMockAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
    const requestId = overrides.requestId || 'req_001';
    const group = createMockRequestGroup({ requestId });
    const issue = createMockIssue({ requestId, ...overrides.issues?.[0] });
    
    return {
      requestId,
      requestGroup: group,
      issues: overrides.issues || [issue],
      summary: {
        totalRequests: 1,
        totalQueries: group.totalQueryCount,
        totalIssues: 1,
        issuesByType: {
          N_PLUS_1: 1,
          DUPLICATE_QUERY: 0,
          DEEP_PAGINATION: 0,
          MISSING_PRELOAD: 0,
          UNUSED_FIELDS: 0,
          LARGE_RESULT_SET: 0,
          MISSING_INDEX: 0,
          SLOW_QUERY: 0,
        },
        issuesBySeverity: {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 0,
          LOW: 0,
        },
        topIssues: [issue],
        totalPotentialImprovement: {
          queryCountReduction: 3,
          durationReductionMs: 150,
          dataTransferReductionBytes: 500,
        },
      },
      analysisTime: new Date(),
      ...overrides,
    };
  }

  function createMockSimulationResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
    const group = createMockRequestGroup();
    
    return {
      requestId: group.requestId,
      originalRequestGroup: group,
      optimizations: [
        {
          id: generateId(),
          type: 'BATCH_QUERY',
          title: 'Batch Query Optimization',
          description: 'Replace N+1 queries with batch query',
          targetIssues: [],
          originalQueries: [],
          optimizedQueries: [],
          impact: {
            queryCountChange: -3,
            queryCountChangePercent: 75,
            durationChangeMs: -150,
            durationChangePercent: 70,
            dataTransferChangeBytes: -500,
            dataTransferChangePercent: 30,
          },
          before: {
            queryCount: 4,
            totalDurationMs: 200,
            totalDataTransferBytes: 1500,
            queries: [],
          },
          after: {
            queryCount: 1,
            totalDurationMs: 50,
            totalDataTransferBytes: 1000,
            queries: [],
          },
        },
      ],
      comparison: {
        original: {
          totalRequests: 1,
          totalQueries: 10,
          totalDurationMs: 250,
          totalDataTransferBytes: 3000,
          avgQueriesPerRequest: 10,
          avgDurationPerRequest: 250,
        },
        optimized: {
          totalRequests: 1,
          totalQueries: 5,
          totalDurationMs: 80,
          totalDataTransferBytes: 1500,
          avgQueriesPerRequest: 5,
          avgDurationPerRequest: 80,
        },
        improvement: {
          queryCountReduction: 5,
          queryCountReductionPercent: 50,
          durationReductionMs: 170,
          durationReductionPercent: 68,
          dataTransferReductionBytes: 1500,
          dataTransferReductionPercent: 50,
        },
      },
      simulationTime: new Date(),
      ...overrides,
    };
  }

  describe('markdown-exporter', () => {
    it('should export analysis results to markdown', () => {
      const result = createMockAnalysisResult();
      const simulation = createMockSimulationResult();

      const markdown = exportMarkdown([result], [simulation]);

      expect(typeof markdown).toBe('string');
      expect(markdown).toContain('# ORM 查询性能分析报告');
      expect(markdown).toContain('📊 概览');
      expect(markdown).toContain('🔍 问题统计');
      expect(markdown).toContain('Test N+1 Issue');
      expect(markdown).toContain('🎯 优化效果模拟');
    });

    it('should include SQL when includeSql option is true', () => {
      const result = createMockAnalysisResult();

      const markdownWithSql = exportMarkdown([result], undefined, { includeSql: true });
      const markdownWithoutSql = exportMarkdown([result], undefined, { includeSql: false });

      expect(markdownWithSql).toContain('SELECT * FROM comments');
      expect(markdownWithoutSql).not.toContain('#### 相关 SQL');
    });

    it('should include suggestions when includeSuggestions option is true', () => {
      const result = createMockAnalysisResult();

      const markdownWithSuggestions = exportMarkdown([result], undefined, { includeSuggestions: true });
      const markdownWithoutSuggestions = exportMarkdown([result], undefined, { includeSuggestions: false });

      expect(markdownWithSuggestions).toContain('💡 优化建议');
      expect(markdownWithSuggestions).toContain('Use batch query');
    });

    it('should handle multiple analysis results', () => {
      const result1 = createMockAnalysisResult({ requestId: 'req_001' });
      const result2 = createMockAnalysisResult({ 
        requestId: 'req_002',
        issues: [createMockIssue({ type: 'SLOW_QUERY', title: 'Slow Query Issue' })],
      });

      const markdown = exportMarkdown([result1, result2]);

      expect(markdown).toContain('req_001');
      expect(markdown).toContain('req_002');
      expect(markdown).toContain('Test N+1 Issue');
      expect(markdown).toContain('Slow Query Issue');
    });

    it('should export without simulation results', () => {
      const result = createMockAnalysisResult();

      const markdown = exportMarkdown([result]);

      expect(markdown).toContain('# ORM 查询性能分析报告');
      expect(markdown).toContain('Test N+1 Issue');
    });
  });

  describe('json-exporter', () => {
    it('should export analysis results to JSON', () => {
      const result = createMockAnalysisResult();
      const simulation = createMockSimulationResult();

      const jsonString = exportJson([result], [simulation]);
      const json = JSON.parse(jsonString);

      expect(json).toBeDefined();
      expect(json.metadata).toBeDefined();
      expect(json.metadata.generatedAt).toBeDefined();
      expect(json.metadata.version).toBe('1.0.0');
      expect(json.summary).toBeDefined();
      expect(json.summary.totalRequests).toBe(1);
      expect(json.summary.totalQueries).toBe(10);
      expect(json.issues).toBeDefined();
      expect(json.issues.length).toBeGreaterThan(0);
    });

    it('should include SQL when includeSql option is true', () => {
      const result = createMockAnalysisResult();

      const jsonWithSql = exportJson([result], undefined, { includeSql: true });
      const jsonWithSqlParsed = JSON.parse(jsonWithSql);

      expect(jsonWithSqlParsed.issues[0].evidence).toBeDefined();
      expect(jsonWithSqlParsed.issues[0].evidence.queries).toContain('SELECT * FROM comments WHERE post_id = 1');
    });

    it('should include simulation data when provided', () => {
      const result = createMockAnalysisResult();
      const simulation = createMockSimulationResult();

      const jsonString = exportJson([result], [simulation]);
      const json = JSON.parse(jsonString);

      expect(json.simulation).toBeDefined();
      expect(json.simulation.summary).toBeDefined();
      expect(json.simulation.summary.original.totalQueries).toBe(10);
      expect(json.simulation.summary.optimized.totalQueries).toBe(5);
      expect(json.simulation.summary.improvement.queryCountReduction).toBe(5);
      expect(json.simulation.optimizations).toBeDefined();
      expect(json.simulation.optimizations.length).toBeGreaterThan(0);
    });

    it('should handle multiple issues with different types', () => {
      const result = createMockAnalysisResult({
        issues: [
          createMockIssue({ type: 'N_PLUS_1', title: 'N+1 Issue' }),
          createMockIssue({ type: 'SLOW_QUERY', title: 'Slow Query', severity: 'MEDIUM' }),
          createMockIssue({ type: 'DUPLICATE_QUERY', title: 'Duplicate Query', severity: 'LOW' }),
        ],
      });

      const jsonString = exportJson([result]);
      const json = JSON.parse(jsonString);

      expect(json.issues.length).toBe(3);
      expect(json.summary.issuesByType['N+1 查询']).toBeGreaterThan(0);
      expect(json.summary.issuesByType['慢查询']).toBeGreaterThan(0);
      expect(json.summary.issuesByType['重复查询']).toBeGreaterThan(0);
    });

    it('should include request details', () => {
      const result = createMockAnalysisResult();

      const jsonString = exportJson([result]);
      const json = JSON.parse(jsonString);

      expect(json.requests).toBeDefined();
      expect(json.requests.length).toBe(1);
      expect(json.requests[0].requestId).toBe('req_001');
      expect(json.requests[0].queryCount).toBe(10);
      expect(json.requests[0].issueCount).toBe(1);
    });
  });

  describe('csv-exporter', () => {
    it('should export analysis results to CSV', () => {
      const result = createMockAnalysisResult();

      const csv = exportCsv([result]);

      expect(typeof csv).toBe('string');
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      
      const header = lines[0];
      expect(header).toContain('序号');
      expect(header).toContain('问题ID');
      expect(header).toContain('类型');
      expect(header).toContain('严重程度');
      expect(header).toContain('标题');
      expect(header).toContain('建议标题');
    });

    it('should include SQL columns when includeSql is true', () => {
      const result = createMockAnalysisResult();

      const csvWithSql = exportCsv([result], { includeSql: true });
      const csvWithoutSql = exportCsv([result], { includeSql: false });

      expect(csvWithSql).toContain('相关SQL示例');
      expect(csvWithSql).toContain('SQL数量');
      expect(csvWithoutSql).not.toContain('相关SQL示例');
    });

    it('should handle special characters in CSV fields', () => {
      const result = createMockAnalysisResult({
        issues: [
          createMockIssue({
            title: 'Issue with "quotes" and, commas',
            description: 'Description with\nnewline',
          }),
        ],
      });

      const csv = exportCsv([result]);

      expect(typeof csv).toBe('string');
      const lines = csv.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });

    it('should export multiple issues correctly', () => {
      const result = createMockAnalysisResult({
        issues: [
          createMockIssue({ type: 'N_PLUS_1', title: 'Issue 1' }),
          createMockIssue({ type: 'SLOW_QUERY', title: 'Issue 2', severity: 'MEDIUM' }),
          createMockIssue({ type: 'DUPLICATE_QUERY', title: 'Issue 3', severity: 'LOW' }),
        ],
      });

      const csv = exportCsv([result]);
      const lines = csv.split('\n');

      expect(lines.length).toBe(4);
    });

    it('should handle multiple analysis results', () => {
      const result1 = createMockAnalysisResult({
        requestId: 'req_001',
        issues: [createMockIssue({ title: 'Issue from req_001' })],
      });
      const result2 = createMockAnalysisResult({
        requestId: 'req_002',
        issues: [createMockIssue({ title: 'Issue from req_002' })],
      });

      const csv = exportCsv([result1, result2]);
      const lines = csv.split('\n');

      expect(lines.length).toBe(3);
      expect(csv).toContain('req_001');
      expect(csv).toContain('req_002');
    });
  });

  describe('report-exporter', () => {
    it('should export report in specified format', () => {
      const result = createMockAnalysisResult();

      const markdownReport = exportReport([result], undefined, { format: 'markdown' });
      const jsonReport = exportReport([result], undefined, { format: 'json' });
      const csvReport = exportReport([result], undefined, { format: 'csv' });

      expect(markdownReport).toContain('# ORM 查询性能分析报告');
      expect(() => JSON.parse(jsonReport)).not.toThrow();
      expect(csvReport).toContain('序号');
    });

    it('should export multiple formats in batch', () => {
      const result = createMockAnalysisResult();
      const simulation = createMockSimulationResult();

      const reports = exportReportsBatch([result], [simulation], {
        formats: ['markdown', 'json', 'csv'],
      });

      expect(reports.markdown).toBeDefined();
      expect(reports.json).toBeDefined();
      expect(reports.csv).toBeDefined();
      expect(reports.summaryCsv).toBeDefined();

      expect(reports.markdown).toContain('# ORM 查询性能分析报告');
      expect(() => JSON.parse(reports.json)).not.toThrow();
      expect(reports.csv).toContain('序号');
    });

    it('should respect options in batch export', () => {
      const result = createMockAnalysisResult();

      const reportsWithSql = exportReportsBatch([result], undefined, {
        formats: ['markdown', 'json'],
        includeSql: true,
      });

      expect(reportsWithSql.markdown).toContain('SELECT * FROM comments');
      const json = JSON.parse(reportsWithSql.json);
      expect(json.issues[0].evidence).toBeDefined();
    });

    it('should throw error for unsupported format', () => {
      const result = createMockAnalysisResult();

      expect(() => {
        exportReport([result], undefined, { format: 'unsupported' as any });
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty analysis results', () => {
      const emptyResult = createMockAnalysisResult({ issues: [] });
      
      const markdown = exportMarkdown([emptyResult]);
      const jsonString = exportJson([emptyResult]);
      const csv = exportCsv([emptyResult]);

      expect(typeof markdown).toBe('string');
      expect(typeof jsonString).toBe('string');
      expect(typeof csv).toBe('string');

      const json = JSON.parse(jsonString);
      expect(json.summary.totalIssues).toBe(0);
    });

    it('should handle issues with different severities', () => {
      const result = createMockAnalysisResult({
        issues: [
          createMockIssue({ severity: 'CRITICAL', title: 'Critical Issue' }),
          createMockIssue({ severity: 'HIGH', title: 'High Issue' }),
          createMockIssue({ severity: 'MEDIUM', title: 'Medium Issue' }),
          createMockIssue({ severity: 'LOW', title: 'Low Issue' }),
        ],
      });

      const jsonString = exportJson([result]);
      const json = JSON.parse(jsonString);

      expect(json.summary.issuesBySeverity['严重']).toBe(1);
      expect(json.summary.issuesBySeverity['高']).toBe(1);
      expect(json.summary.issuesBySeverity['中']).toBe(1);
      expect(json.summary.issuesBySeverity['低']).toBe(1);
    });

    it('should sort issues by severity in export', () => {
      const result = createMockAnalysisResult({
        issues: [
          createMockIssue({ severity: 'LOW', title: 'Low Issue' }),
          createMockIssue({ severity: 'CRITICAL', title: 'Critical Issue' }),
          createMockIssue({ severity: 'MEDIUM', title: 'Medium Issue' }),
          createMockIssue({ severity: 'HIGH', title: 'High Issue' }),
        ],
      });

      const jsonString = exportJson([result]);
      const json = JSON.parse(jsonString);

      expect(json.issues[0].severity).toBe('CRITICAL');
      expect(json.issues[1].severity).toBe('HIGH');
      expect(json.issues[2].severity).toBe('MEDIUM');
      expect(json.issues[3].severity).toBe('LOW');
    });
  });
});
