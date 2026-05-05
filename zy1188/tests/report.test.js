'use strict';

const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const ReportGenerator = require('../src/report');

describe('ReportGenerator', () => {
  let tempDir;
  let reportGenerator;
  let mockResults;

  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
    reportGenerator = new ReportGenerator();
    
    mockResults = {
      metadata: {
        scanTime: '2024-05-15T10:30:00.000Z',
        duration: 1500,
        codeDirectory: '/test/project',
        databasePath: '/test/project/data/app.db',
        minRiskLevel: 'low',
        scannerVersion: '1.0.0'
      },
      stats: {
        totalFiles: 10,
        totalIssues: 5,
        issuesPerFile: 0.5,
        riskScore: 250,
        bySeverity: {
          critical: 1,
          high: 2,
          medium: 1,
          low: 1
        },
        byType: {
          'STRING_CONCAT_SQL': {
            name: '字符串拼接SQL',
            count: 2,
            severity: 'critical'
          },
          'DYNAMIC_TABLE_NO_WHITELIST': {
            name: '动态表名无白名单',
            count: 1,
            severity: 'high'
          }
        },
        byFile: {
          '/test/project/src/user-controller.js': 3,
          '/test/project/src/auth.js': 2
        }
      },
      issues: [
        {
          id: 'STRING_CONCAT_SQL',
          name: '字符串拼接SQL',
          severity: 'critical',
          description: '使用字符串拼接操作符构建SQL语句',
          filePath: '/test/project/src/user-controller.js',
          lineNumber: 15,
          column: 1,
          matchedText: '"SELECT * FROM users WHERE id = " + userId',
          fixSuggestion: '使用参数化查询替代字符串拼接',
          examples: ['const sql = "SELECT * FROM users WHERE id = " + userId;'],
          context: [
            { lineNumber: 13, content: 'function getUser(id) {', isIssue: false },
            { lineNumber: 14, content: '  // Vulnerable code', isIssue: false },
            { lineNumber: 15, content: '  const sql = "SELECT * FROM users WHERE id = " + userId;', isIssue: true },
            { lineNumber: 16, content: '  return db.query(sql);', isIssue: false }
          ]
        },
        {
          id: 'DYNAMIC_TABLE_NO_WHITELIST',
          name: '动态表名无白名单',
          severity: 'high',
          description: '直接使用用户输入作为表名',
          filePath: '/test/project/src/auth.js',
          lineNumber: 25,
          column: 1,
          matchedText: '`SELECT * FROM ${tableName}`',
          fixSuggestion: '使用白名单验证动态表名',
          context: [
            { lineNumber: 24, content: 'function getTableData(tableName) {', isIssue: false },
            { lineNumber: 25, content: '  const sql = `SELECT * FROM ${tableName}`;', isIssue: true }
          ]
        }
      ],
      filesScanned: [
        '/test/project/src/user-controller.js',
        '/test/project/src/auth.js',
        '/test/project/src/db.js'
      ]
    };
  });

  afterEach(() => {
    tempDir.removeCallback();
  });

  describe('Markdown report generation', () => {
    test('should generate valid markdown report', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
      
      expect(markdown).toContain('# SQL注入风险扫描报告');
      expect(markdown).toContain('扫描时间');
      expect(markdown).toContain('扫描摘要');
    });

    test('should include metadata in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain(mockResults.metadata.codeDirectory);
      expect(markdown).toContain(mockResults.metadata.databasePath);
      expect(markdown).toContain(mockResults.metadata.scannerVersion);
    });

    test('should include statistics in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain(`扫描文件数`);
      expect(markdown).toContain(`${mockResults.stats.totalFiles}`);
      expect(markdown).toContain(`发现问题数`);
      expect(markdown).toContain(`${mockResults.stats.totalIssues}`);
      expect(markdown).toContain(`${mockResults.stats.riskScore}`);
    });

    test('should include severity distribution in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain('严重');
      expect(markdown).toContain('高危');
      expect(markdown).toContain('中危');
      expect(markdown).toContain('低危');
      
      expect(markdown).toContain('1 个问题');
      expect(markdown).toContain('2 个问题');
    });

    test('should include issue details in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain('问题详情');
      
      for (const issue of mockResults.issues) {
        expect(markdown).toContain(issue.name);
        expect(markdown).toContain(issue.description);
        expect(markdown).toContain(`src${path.sep}user-controller.js:15`);
        expect(markdown).toContain(issue.fixSuggestion);
      }
    });

    test('should include code context in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain('上下文代码');
      expect(markdown).toContain('```');
      expect(markdown).toContain('function getUser(id)');
      expect(markdown).toContain('>>>');
    });

    test('should include security recommendations in markdown', () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      
      expect(markdown).toContain('安全建议');
      expect(markdown).toContain('通用防护原则');
      expect(markdown).toContain('快速修复检查清单');
      expect(markdown).toContain('参数绑定');
    });

    test('should handle empty issues gracefully', () => {
      const emptyResults = {
        ...mockResults,
        stats: {
          ...mockResults.stats,
          totalIssues: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
        },
        issues: []
      };
      
      const markdown = reportGenerator.toMarkdown(emptyResults);
      
      expect(markdown).toContain('# SQL注入风险扫描报告');
      expect(markdown).toContain('发现问题数');
    });
  });

  describe('JSON report generation', () => {
    test('should generate valid JSON report', () => {
      const json = reportGenerator.toJSON(mockResults);
      
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should parse back to correct structure', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(parsed.issues).toBeDefined();
      expect(parsed.filesScanned).toBeDefined();
    });

    test('should include all metadata in JSON', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      expect(parsed.metadata.scanTime).toBe(mockResults.metadata.scanTime);
      expect(parsed.metadata.codeDirectory).toBe(mockResults.metadata.codeDirectory);
      expect(parsed.metadata.databasePath).toBe(mockResults.metadata.databasePath);
      expect(parsed.metadata.minRiskLevel).toBe(mockResults.metadata.minRiskLevel);
      expect(parsed.metadata.scannerVersion).toBe(mockResults.metadata.scannerVersion);
      expect(parsed.metadata.generatedAt).toBeDefined();
    });

    test('should include summary statistics in JSON', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      expect(parsed.summary.totalFiles).toBe(mockResults.stats.totalFiles);
      expect(parsed.summary.totalIssues).toBe(mockResults.stats.totalIssues);
      expect(parsed.summary.issuesPerFile).toBe(mockResults.stats.issuesPerFile);
      expect(parsed.summary.riskScore).toBe(mockResults.stats.riskScore);
      expect(parsed.summary.bySeverity).toEqual(mockResults.stats.bySeverity);
    });

    test('should include issues in JSON', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      expect(parsed.issues.length).toBe(mockResults.issues.length);
      
      for (let i = 0; i < mockResults.issues.length; i++) {
        expect(parsed.issues[i].id).toBe(mockResults.issues[i].id);
        expect(parsed.issues[i].name).toBe(mockResults.issues[i].name);
        expect(parsed.issues[i].severity).toBe(mockResults.issues[i].severity);
        expect(parsed.issues[i].filePath).toBe(mockResults.issues[i].filePath);
        expect(parsed.issues[i].lineNumber).toBe(mockResults.issues[i].lineNumber);
        expect(parsed.issues[i].matchedText).toBe(mockResults.issues[i].matchedText);
        expect(parsed.issues[i].fixSuggestion).toBe(mockResults.issues[i].fixSuggestion);
      }
    });

    test('should include context in JSON issues', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      for (let i = 0; i < mockResults.issues.length; i++) {
        if (mockResults.issues[i].context) {
          expect(parsed.issues[i].context).toBeDefined();
          expect(Array.isArray(parsed.issues[i].context)).toBe(true);
          
          for (let j = 0; j < mockResults.issues[i].context.length; j++) {
            expect(parsed.issues[i].context[j].lineNumber).toBe(
              mockResults.issues[i].context[j].lineNumber
            );
            expect(parsed.issues[i].context[j].content).toBe(
              mockResults.issues[i].context[j].content
            );
            expect(parsed.issues[i].context[j].isIssue).toBe(
              mockResults.issues[i].context[j].isIssue
            );
          }
        }
      }
    });

    test('should include filesScanned in JSON', () => {
      const json = reportGenerator.toJSON(mockResults);
      const parsed = JSON.parse(json);
      
      expect(Array.isArray(parsed.filesScanned)).toBe(true);
      expect(parsed.filesScanned.length).toBe(mockResults.filesScanned.length);
    });
  });

  describe('Save report to file', () => {
    test('should save markdown report to file', async () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      const outputPath = path.join(tempDir.name, 'report.md');
      
      const savedPath = await reportGenerator.saveReport(markdown, outputPath);
      
      expect(fs.existsSync(savedPath)).toBe(true);
      
      const content = await fs.readFile(savedPath, 'utf-8');
      expect(content).toBe(markdown);
    });

    test('should save JSON report to file', async () => {
      const json = reportGenerator.toJSON(mockResults);
      const outputPath = path.join(tempDir.name, 'report.json');
      
      const savedPath = await reportGenerator.saveReport(json, outputPath);
      
      expect(fs.existsSync(savedPath)).toBe(true);
      
      const content = await fs.readFile(savedPath, 'utf-8');
      expect(content).toBe(json);
      
      expect(() => JSON.parse(content)).not.toThrow();
    });

    test('should create directory if not exists', async () => {
      const nestedDir = path.join(tempDir.name, 'nested', 'dir');
      const outputPath = path.join(nestedDir, 'report.md');
      
      expect(fs.existsSync(nestedDir)).toBe(false);
      
      const markdown = reportGenerator.toMarkdown(mockResults);
      await reportGenerator.saveReport(markdown, outputPath);
      
      expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should return the saved file path', async () => {
      const markdown = reportGenerator.toMarkdown(mockResults);
      const outputPath = path.join(tempDir.name, 'test-report.md');
      
      const savedPath = await reportGenerator.saveReport(markdown, outputPath);
      
      expect(savedPath).toBe(outputPath);
    });
  });

  describe('Helper methods', () => {
    test('getSeverityEmoji should return correct emoji', () => {
      expect(reportGenerator._getSeverityEmoji('critical')).toBe('🔴');
      expect(reportGenerator._getSeverityEmoji('high')).toBe('🟠');
      expect(reportGenerator._getSeverityEmoji('medium')).toBe('🟡');
      expect(reportGenerator._getSeverityEmoji('low')).toBe('🔵');
      expect(reportGenerator._getSeverityEmoji('unknown')).toBe('⚪');
    });

    test('getSeverityLabel should return correct label', () => {
      expect(reportGenerator._getSeverityLabel('critical')).toBe('严重');
      expect(reportGenerator._getSeverityLabel('high')).toBe('高危');
      expect(reportGenerator._getSeverityLabel('medium')).toBe('中危');
      expect(reportGenerator._getSeverityLabel('low')).toBe('低危');
    });

    test('formatDuration should format correctly', () => {
      expect(reportGenerator._formatDuration(500)).toBe('500ms');
      expect(reportGenerator._formatDuration(1500)).toBe('1.50s');
      expect(reportGenerator._formatDuration(2000)).toBe('2.00s');
      expect(reportGenerator._formatDuration(12345)).toBe('12.35s');
    });

    test('formatCodeContext should format correctly', () => {
      const context = [
        { lineNumber: 1, content: 'function test() {', isIssue: false },
        { lineNumber: 2, content: '  const sql = "SELECT * FROM users";', isIssue: true },
        { lineNumber: 3, content: '}', isIssue: false }
      ];
      
      const formatted = reportGenerator._formatCodeContext(context);
      
      expect(formatted).toContain('```');
      expect(formatted).toContain('  1 | function test() {');
      expect(formatted).toContain('>>>   2 | const sql = "SELECT * FROM users";');
      expect(formatted).toContain('  3 | }');
    });

    test('formatCodeContext should handle empty context', () => {
      const formatted = reportGenerator._formatCodeContext(null);
      expect(formatted).toBe('');
      
      const formatted2 = reportGenerator._formatCodeContext([]);
      expect(formatted2).toBe('');
    });
  });
});
