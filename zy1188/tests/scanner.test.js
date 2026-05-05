'use strict';

const fs = require('fs-extra');
const path = require('path');
const tmp = require('tmp');
const Scanner = require('../src/scanner');
const { RISK_LEVELS } = require('../src/patterns');

describe('Scanner', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterEach(() => {
    tempDir.removeCallback();
  });

  async function createTestFile(filename, content) {
    const filePath = path.join(tempDir.name, filename);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  describe('Constructor and validation', () => {
    test('should throw error for non-existent code directory', () => {
      const nonExistentPath = path.join(tempDir.name, 'non-existent');
      expect(() => {
        new Scanner({ codeDir: nonExistentPath });
      }).toThrow('代码目录不存在');
    });

    test('should throw error for file path instead of directory', async () => {
      const filePath = await createTestFile('test.js', 'const x = 1;');
      expect(() => {
        new Scanner({ codeDir: filePath });
      }).toThrow('指定的路径不是目录');
    });

    test('should throw error for invalid risk level', () => {
      expect(() => {
        new Scanner({ codeDir: tempDir.name, minRiskLevel: 'invalid' });
      }).toThrow('无效的风险级别');
    });

    test('should throw error for non-existent database path', () => {
      const nonExistentDb = path.join(tempDir.name, 'nonexistent.db');
      expect(() => {
        new Scanner({ codeDir: tempDir.name, databasePath: nonExistentDb });
      }).toThrow('数据库文件不存在');
    });

    test('should create scanner with valid options', () => {
      expect(() => {
        new Scanner({ codeDir: tempDir.name });
      }).not.toThrow();
    });
  });

  describe('String concatenation SQL detection', () => {
    test('should detect string concatenation with + operator', async () => {
      await createTestFile('test.js', `
        const userId = req.params.id;
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'STRING_CONCAT_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.CRITICAL);
    });

    test('should detect string concatenation in INSERT statement', async () => {
      await createTestFile('test.js', `
        const sql = "INSERT INTO users (name) VALUES ('" + name + "')";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'STRING_CONCAT_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });

    test('should detect string concatenation in UPDATE statement', async () => {
      await createTestFile('test.js', `
        const sql = "UPDATE users SET name = '" + newName + "' WHERE id = " + id;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'STRING_CONCAT_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('Template literal SQL detection', () => {
    test('should detect template literal interpolation', async () => {
      await createTestFile('test.js', `
        const userId = req.params.id;
        const sql = \`SELECT * FROM users WHERE id = \${userId}\`;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'TEMPLATE_LITERAL_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.CRITICAL);
    });

    test('should detect template literal with LIKE pattern', async () => {
      await createTestFile('test.js', `
        const sql = \`SELECT * FROM users WHERE name LIKE '%\${search}%'\`;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'TEMPLATE_LITERAL_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });

    test('should detect multiline template literals', async () => {
      await createTestFile('test.js', `
        const sql = \`
          SELECT u.*, o.order_number
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE u.id = \${userId}
          AND o.status = '\${status}'
        \`;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'TEMPLATE_LITERAL_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('User input detection', () => {
    test('should detect req.body usage in SQL', async () => {
      await createTestFile('test.js', `
        const username = req.body.username;
        const sql = "SELECT * FROM users WHERE username = '" + username + "'";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'USER_INPUT_IN_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.CRITICAL);
    });

    test('should detect req.params usage', async () => {
      await createTestFile('test.js', `
        const id = req.params.id;
        const sql = \`SELECT * FROM products WHERE id = \${id}\`;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'USER_INPUT_IN_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });

    test('should detect req.query usage', async () => {
      await createTestFile('test.js', `
        const category = req.query.category;
        const sql = "SELECT * FROM products WHERE category = '" + category + "'";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'USER_INPUT_IN_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('Dynamic table name detection', () => {
    test('should detect dynamic table name without whitelist', async () => {
      await createTestFile('test.js', `
        const tableName = req.query.table;
        const sql = "SELECT * FROM " + tableName;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'DYNAMIC_TABLE_NO_WHITELIST');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.HIGH);
    });

    test('should detect dynamic table name in template literal', async () => {
      await createTestFile('test.js', `
        const sql = \`SELECT * FROM \${tableName}\`;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'DYNAMIC_TABLE_NO_WHITELIST');
      expect(issues.length).toBeGreaterThan(0);
    });

    test('should detect dynamic column in ORDER BY', async () => {
      await createTestFile('test.js', `
        const sortBy = req.query.sortBy;
        const sql = "SELECT * FROM users ORDER BY " + sortBy;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'DYNAMIC_TABLE_NO_WHITELIST');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('String format function detection', () => {
    test('should detect util.format usage', async () => {
      await createTestFile('test.js', `
        const sql = require('util').format(
          "SELECT * FROM users WHERE id = %s",
          userId
        );
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'STRING_FORMAT_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.HIGH);
    });

    test('should detect sprintf usage', async () => {
      await createTestFile('test.js', `
        const sql = sprintf("SELECT * FROM users WHERE name = '%s'", name);
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'STRING_FORMAT_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('SQL comment detection', () => {
    test('should detect SQL comment pattern', async () => {
      await createTestFile('test.js', `
        const sql = "SELECT * FROM users WHERE id = " + input + " --";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'COMMENT_IN_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.MEDIUM);
    });
  });

  describe('UNION detection', () => {
    test('should detect UNION in SQL context', async () => {
      await createTestFile('test.js', `
        const sql = "SELECT * FROM products WHERE id = " + id + 
                    " UNION SELECT * FROM users";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'UNION_SQL_INJECTION');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.MEDIUM);
    });
  });

  describe('Execute dynamic SQL detection', () => {
    test('should detect eval usage with SQL', async () => {
      await createTestFile('test.js', \`
        const sql = "SELECT * FROM users WHERE id = " + userId;
        eval("db.query('" + sql + "')");
      \`);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'EXECUTE_DYNAMIC_SQL');
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].severity).toBe(RISK_LEVELS.CRITICAL);
    });

    test('should detect new Function usage', async () => {
      await createTestFile('test.js', `
        const func = new Function("return db.query('" + sql + "')");
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issues = result.issues.filter(i => i.id === 'EXECUTE_DYNAMIC_SQL');
      expect(issues.length).toBeGreaterThan(0);
    });
  });

  describe('Risk level filtering', () => {
    beforeEach(async () => {
      await createTestFile('test.js', `
        // Critical - string concat
        const sql1 = "SELECT * FROM users WHERE id = " + userId;
        
        // High - dynamic table
        const sql2 = \`SELECT * FROM \${tableName}\`;
        
        // Medium - comment
        const sql3 = "SELECT * FROM users WHERE id = " + input + " --";
        
        // Low - hardcoded values
        const sql4 = "SELECT * FROM users WHERE status = 'active'";
      `);
    });

    test('should filter by minimum risk level - critical', async () => {
      const scanner = new Scanner({ 
        codeDir: tempDir.name, 
        minRiskLevel: 'critical' 
      });
      const result = await scanner.scan();

      expect(result.stats.bySeverity.critical).toBeGreaterThan(0);
      expect(result.stats.bySeverity.high).toBe(0);
      expect(result.stats.bySeverity.medium).toBe(0);
      expect(result.stats.bySeverity.low).toBe(0);
    });

    test('should filter by minimum risk level - high', async () => {
      const scanner = new Scanner({ 
        codeDir: tempDir.name, 
        minRiskLevel: 'high' 
      });
      const result = await scanner.scan();

      expect(result.stats.bySeverity.critical).toBeGreaterThan(0);
      expect(result.stats.bySeverity.high).toBeGreaterThan(0);
      expect(result.stats.bySeverity.medium).toBe(0);
      expect(result.stats.bySeverity.low).toBe(0);
    });

    test('should filter by minimum risk level - medium', async () => {
      const scanner = new Scanner({ 
        codeDir: tempDir.name, 
        minRiskLevel: 'medium' 
      });
      const result = await scanner.scan();

      expect(result.stats.bySeverity.critical).toBeGreaterThan(0);
      expect(result.stats.bySeverity.high).toBeGreaterThan(0);
      expect(result.stats.bySeverity.medium).toBeGreaterThan(0);
      expect(result.stats.bySeverity.low).toBe(0);
    });

    test('should include all issues with low threshold', async () => {
      const scanner = new Scanner({ 
        codeDir: tempDir.name, 
        minRiskLevel: 'low' 
      });
      const result = await scanner.scan();

      expect(result.stats.totalIssues).toBeGreaterThan(0);
    });
  });

  describe('File filtering', () => {
    test('should ignore node_modules directory', async () => {
      await createTestFile('node_modules/vuln.js', `
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);
      await createTestFile('src/valid.js', `
        const sql = "SELECT * FROM users WHERE id = ?";
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const nodeModulesIssues = result.issues.filter(i => 
        i.filePath.includes('node_modules')
      );
      expect(nodeModulesIssues.length).toBe(0);
    });

    test('should ignore dist directory', async () => {
      await createTestFile('dist/bundle.js', `
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const distIssues = result.issues.filter(i => 
        i.filePath.includes('dist')
      );
      expect(distIssues.length).toBe(0);
    });

    test('should ignore test directories', async () => {
      await createTestFile('tests/vuln.test.js', `
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const testIssues = result.issues.filter(i => 
        i.filePath.includes('test')
      );
      expect(testIssues.length).toBe(0);
    });

    test('should ignore minified files', async () => {
      await createTestFile('app.min.js', `
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const minifiedIssues = result.issues.filter(i => 
        i.filePath.includes('.min.')
      );
      expect(minifiedIssues.length).toBe(0);
    });
  });

  describe('Scan statistics', () => {
    beforeEach(async () => {
      await createTestFile('file1.js', `
        const sql = "SELECT * FROM users WHERE id = " + userId;
      `);
      await createTestFile('file2.js', `
        const sql = \`SELECT * FROM \${tableName}\`;
      `);
    });

    test('should calculate correct total files', async () => {
      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      expect(result.stats.totalFiles).toBe(2);
    });

    test('should calculate correct total issues', async () => {
      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      expect(result.stats.totalIssues).toBeGreaterThan(0);
    });

    test('should calculate by severity counts', async () => {
      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      expect(result.stats.bySeverity.critical).toBeGreaterThan(0);
      expect(result.stats.bySeverity.high).toBeGreaterThan(0);
    });

    test('should calculate by type counts', async () => {
      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      expect(result.stats.byType['STRING_CONCAT_SQL']).toBeDefined();
      expect(result.stats.byType['DYNAMIC_TABLE_NO_WHITELIST']).toBeDefined();
    });

    test('should calculate risk score', async () => {
      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      expect(result.stats.riskScore).toBeGreaterThan(0);
    });
  });

  describe('Deduplication', () => {
    test('should deduplicate same issue on same line', async () => {
      await createTestFile('test.js', `
        // Multiple patterns may match this same line
        const sql = "SELECT * FROM users WHERE id = " + req.params.id;
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      for (const issue of criticalIssues) {
        const sameFileLine = result.issues.filter(i => 
          i.id === issue.id && 
          i.filePath === issue.filePath && 
          i.lineNumber === issue.lineNumber
        );
        expect(sameFileLine.length).toBe(1);
      }
    });
  });

  describe('Context extraction', () => {
    test('should include code context with issues', async () => {
      await createTestFile('test.js', `
        // This is a comment
        function getUser(id) {
          const sql = "SELECT * FROM users WHERE id = " + id;
          return db.query(sql);
        }
      `);

      const scanner = new Scanner({ codeDir: tempDir.name });
      const result = await scanner.scan();

      const issue = result.issues.find(i => i.id === 'STRING_CONCAT_SQL');
      expect(issue).toBeDefined();
      expect(issue.context).toBeDefined();
      expect(Array.isArray(issue.context)).toBe(true);
      expect(issue.context.length).toBeGreaterThan(0);
      
      const issueLine = issue.context.find(c => c.isIssue);
      expect(issueLine).toBeDefined();
      expect(issueLine.lineNumber).toBe(issue.lineNumber);
    });
  });
});
