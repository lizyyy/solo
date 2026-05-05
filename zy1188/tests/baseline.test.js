'use strict';

const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const BaselineManager = require('../src/baseline');

describe('BaselineManager', () => {
  let tempDir;
  let baselinePath;
  let baselineManager;

  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
    baselinePath = path.join(tempDir.name, '.sql-scan-baseline.json');
    baselineManager = new BaselineManager(baselinePath);
  });

  afterEach(() => {
    tempDir.removeCallback();
  });

  describe('File operations', () => {
    test('exists should return false for non-existent file', () => {
      expect(baselineManager.exists()).toBe(false);
    });

    test('exists should return true for existing file', async () => {
      await fs.writeFile(baselinePath, JSON.stringify({ ignored: [] }), 'utf-8');
      expect(baselineManager.exists()).toBe(true);
    });

    test('load should return default structure for non-existent file', () => {
      const baseline = baselineManager.load();
      
      expect(baseline).toBeDefined();
      expect(baseline.version).toBe('1.0');
      expect(baseline.createdAt).toBeDefined();
      expect(Array.isArray(baseline.ignored)).toBe(true);
      expect(baseline.ignored.length).toBe(0);
    });

    test('load should return saved structure', async () => {
      const testData = {
        version: '1.0',
        createdAt: '2024-05-15T10:00:00.000Z',
        ignored: [
          { file: '/test/file.js', line: 10, reason: 'test' }
        ]
      };
      
      await fs.writeFile(baselinePath, JSON.stringify(testData), 'utf-8');
      
      const loaded = baselineManager.load();
      
      expect(loaded.version).toBe(testData.version);
      expect(loaded.createdAt).toBe(testData.createdAt);
      expect(loaded.ignored.length).toBe(1);
      expect(loaded.ignored[0].file).toBe('/test/file.js');
    });

    test('save should write file correctly', async () => {
      const baseline = {
        version: '1.0',
        createdAt: '2024-05-15T10:00:00.000Z',
        ignored: []
      };
      
      await baselineManager.save(baseline);
      
      expect(fs.existsSync(baselinePath)).toBe(true);
      
      const content = await fs.readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed.version).toBe(baseline.version);
      expect(parsed.updatedAt).toBeDefined();
    });

    test('save should add updatedAt timestamp', async () => {
      const baseline = {
        version: '1.0',
        ignored: []
      };
      
      await baselineManager.save(baseline);
      
      const content = await fs.readFile(baselinePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed.updatedAt).toBeDefined();
      expect(new Date(parsed.updatedAt).getTime()).not.toBeNaN();
    });
  });

  describe('Create from scan results', () => {
    test('should create baseline from scan results', async () => {
      const mockResults = {
        metadata: {
          scanTime: '2024-05-15T10:00:00.000Z',
          codeDirectory: '/test/project',
          scannerVersion: '1.0.0'
        },
        issues: [
          {
            id: 'STRING_CONCAT_SQL',
            name: '字符串拼接SQL',
            severity: 'critical',
            filePath: '/test/file1.js',
            lineNumber: 15,
            matchedText: '"SELECT * FROM users WHERE id = " + userId'
          },
          {
            id: 'TEMPLATE_LITERAL_SQL',
            name: '模板字面量拼接SQL',
            severity: 'critical',
            filePath: '/test/file2.js',
            lineNumber: 25,
            matchedText: '`SELECT * FROM users WHERE id = ${userId}`'
          }
        ]
      };

      const outputPath = path.join(tempDir.name, 'test-baseline.json');
      const baseline = await baselineManager.createFromResults(mockResults, outputPath);

      expect(baseline.version).toBe('1.0');
      expect(baseline.createdAt).toBeDefined();
      expect(baseline.scanMetadata).toBeDefined();
      expect(baseline.scanMetadata.scanTime).toBe(mockResults.metadata.scanTime);
      expect(baseline.ignored.length).toBe(2);
      expect(baseline.notes).toBeDefined();

      expect(baseline.ignored[0].id).toBe('STRING_CONCAT_SQL');
      expect(baseline.ignored[0].file).toBe('/test/file1.js');
      expect(baseline.ignored[0].line).toBe(15);
      expect(baseline.ignored[0].reviewStatus).toBe('pending');

      expect(baseline.ignored[1].id).toBe('TEMPLATE_LITERAL_SQL');
      expect(baseline.ignored[1].file).toBe('/test/file2.js');
      expect(baseline.ignored[1].line).toBe(25);
    });

    test('should save baseline to specified path', async () => {
      const mockResults = {
        metadata: { scanTime: '2024-05-15T10:00:00.000Z', codeDirectory: '/test' },
        issues: [{
          id: 'TEST_ISSUE',
          name: 'Test Issue',
          severity: 'high',
          filePath: '/test/file.js',
          lineNumber: 10,
          matchedText: 'test'
        }]
      };

      const customPath = path.join(tempDir.name, 'custom-baseline.json');
      await baselineManager.createFromResults(mockResults, customPath);

      expect(fs.existsSync(customPath)).toBe(true);
    });
  });

  describe('Add and remove ignore', () => {
    test('addIgnore should add new ignore item', () => {
      const baseline = {
        version: '1.0',
        ignored: []
      };

      const result = baselineManager.addIgnore(baseline, '/test/file.js', 10, 'Test reason');

      expect(result).toBe(true);
      expect(baseline.ignored.length).toBe(1);
      expect(baseline.ignored[0].file).toBe('/test/file.js');
      expect(baseline.ignored[0].line).toBe(10);
      expect(baseline.ignored[0].reason).toBe('Test reason');
      expect(baseline.ignored[0].addedAt).toBeDefined();
      expect(baseline.ignored[0].reviewStatus).toBe('approved');
    });

    test('addIgnore should not add duplicate', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10, reason: 'Existing' }
        ]
      };

      const result = baselineManager.addIgnore(baseline, '/test/file.js', 10, 'New reason');

      expect(result).toBe(false);
      expect(baseline.ignored.length).toBe(1);
    });

    test('addIgnore should update reason for existing if provided', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10, reason: 'Existing' }
        ]
      };

      baselineManager.addIgnore(baseline, '/test/file.js', 10, 'Updated reason');

      expect(baseline.ignored[0].reason).toBe('Updated reason');
    });

    test('removeIgnore should remove existing item', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file1.js', line: 10 },
          { file: '/test/file2.js', line: 20 }
        ]
      };

      const result = baselineManager.removeIgnore(baseline, '/test/file1.js', 10);

      expect(result).toBe(true);
      expect(baseline.ignored.length).toBe(1);
      expect(baseline.ignored[0].file).toBe('/test/file2.js');
    });

    test('removeIgnore should return false for non-existent item', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10 }
        ]
      };

      const result = baselineManager.removeIgnore(baseline, '/test/other.js', 99);

      expect(result).toBe(false);
      expect(baseline.ignored.length).toBe(1);
    });
  });

  describe('Filter results', () => {
    let mockResults;

    beforeEach(() => {
      mockResults = {
        metadata: { scanTime: '2024-05-15T10:00:00.000Z' },
        stats: {
          totalFiles: 2,
          totalIssues: 3,
          bySeverity: { critical: 1, high: 1, medium: 1, low: 0 },
          byType: {},
          byFile: {}
        },
        issues: [
          {
            id: 'STRING_CONCAT_SQL',
            name: '字符串拼接SQL',
            severity: 'critical',
            filePath: '/test/file1.js',
            lineNumber: 15
          },
          {
            id: 'TEMPLATE_LITERAL_SQL',
            name: '模板字面量拼接SQL',
            severity: 'high',
            filePath: '/test/file1.js',
            lineNumber: 25
          },
          {
            id: 'DYNAMIC_TABLE_NO_WHITELIST',
            name: '动态表名无白名单',
            severity: 'medium',
            filePath: '/test/file2.js',
            lineNumber: 10
          }
        ]
      };
    });

    test('should not filter when baseline is empty', () => {
      const baseline = {
        version: '1.0',
        ignored: []
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.issues.length).toBe(mockResults.issues.length);
      expect(filtered.baselineApplied).toBe(true);
      expect(filtered.ignoredCount).toBe(0);
    });

    test('should filter by file and line', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file1.js', line: 15 }
        ]
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.issues.length).toBe(2);
      expect(filtered.ignoredCount).toBe(1);
      
      const remainingIds = filtered.issues.map(i => i.id);
      expect(remainingIds).not.toContain('STRING_CONCAT_SQL');
      expect(remainingIds).toContain('TEMPLATE_LITERAL_SQL');
      expect(remainingIds).toContain('DYNAMIC_TABLE_NO_WHITELIST');
    });

    test('should filter by issue id', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { id: 'TEMPLATE_LITERAL_SQL' }
        ]
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.issues.length).toBe(2);
      
      const remainingIds = filtered.issues.map(i => i.id);
      expect(remainingIds).not.toContain('TEMPLATE_LITERAL_SQL');
    });

    test('should filter by issue id with file and line', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { id: 'STRING_CONCAT_SQL', file: '/test/file1.js', line: 15 }
        ]
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.issues.length).toBe(2);
    });

    test('should update statistics after filtering', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file1.js', line: 15 }
        ]
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.stats.totalIssues).toBe(2);
      expect(filtered.stats.bySeverity.critical).toBe(0);
      expect(filtered.stats.bySeverity.high).toBe(1);
      expect(filtered.stats.bySeverity.medium).toBe(1);
    });

    test('should handle null baseline', () => {
      const filtered = baselineManager.filterResults(mockResults, null);

      expect(filtered.issues.length).toBe(mockResults.issues.length);
    });

    test('should handle undefined ignored array', () => {
      const baseline = {
        version: '1.0'
      };

      const filtered = baselineManager.filterResults(mockResults, baseline);

      expect(filtered.issues.length).toBe(mockResults.issues.length);
    });
  });

  describe('Validate', () => {
    test('should validate valid baseline', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10, reason: 'Reviewed and safe', reviewStatus: 'approved' }
        ]
      };

      const result = baselineManager.validate(baseline);

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should warn about missing version', () => {
      const baseline = {
        ignored: []
      };

      const result = baselineManager.validate(baseline);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('版本号'))).toBe(true);
    });

    test('should error if ignored is not array', () => {
      const baseline = {
        version: '1.0',
        ignored: 'not an array'
      };

      const result = baselineManager.validate(baseline);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should warn about pending review status', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10, reviewStatus: 'pending' }
        ]
      };

      const result = baselineManager.validate(baseline);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('pending'))).toBe(true);
    });

    test('should warn about vague reasons', () => {
      const baseline = {
        version: '1.0',
        ignored: [
          { file: '/test/file.js', line: 10, reason: '自动添加到Baseline - 请审查并更新原因' }
        ]
      };

      const result = baselineManager.validate(baseline);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('原因描述'))).toBe(true);
    });
  });

  describe('Merge', () => {
    test('should merge two baselines', async () => {
      const baseline1 = {
        version: '1.0',
        createdAt: '2024-05-10T10:00:00.000Z',
        ignored: [
          { file: '/test/file1.js', line: 10, reason: 'From baseline1' }
        ]
      };

      const baseline2 = {
        version: '1.0',
        createdAt: '2024-05-15T10:00:00.000Z',
        ignored: [
          { file: '/test/file2.js', line: 20, reason: 'From baseline2' }
        ]
      };

      const merged = await baselineManager.merge(baseline1, baseline2);

      expect(merged.ignored.length).toBe(2);
      expect(merged.mergedAt).toBeDefined();
    });

    test('should deduplicate during merge', async () => {
      const baseline1 = {
        version: '1.0',
        ignored: [
          { id: 'TEST', file: '/test/file.js', line: 10 }
        ]
      };

      const baseline2 = {
        version: '1.0',
        ignored: [
          { id: 'TEST', file: '/test/file.js', line: 10 }
        ]
      };

      const merged = await baselineManager.merge(baseline1, baseline2);

      expect(merged.ignored.length).toBe(1);
    });
  });
});
