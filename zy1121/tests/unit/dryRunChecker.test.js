const DryRunChecker = require('../../src/services/dryRunChecker');
const path = require('path');
const fs = require('fs');
const temp = require('temp');

temp.track();

describe('DryRunChecker', () => {
  let tempDir;
  
  beforeEach(() => {
    tempDir = temp.mkdirSync('dry-run-test-');
  });
  
  afterEach(() => {
    temp.cleanupSync();
  });
  
  describe('createTempDbPath', () => {
    it('should create valid temp db path', () => {
      const originalTempDir = process.env.TEMP_DIR;
      process.env.TEMP_DIR = tempDir;
      
      const tempPath = DryRunChecker.createTempDbPath();
      
      expect(tempPath).toContain('dry-run-');
      expect(tempPath).toContain('.db');
      
      process.env.TEMP_DIR = originalTempDir;
    });
  });
  
  describe('createEmptyDb', () => {
    it('should create an empty SQLite database', async () => {
      const dbPath = path.join(tempDir, 'test-empty.db');
      
      await DryRunChecker.createEmptyDb(dbPath);
      
      expect(fs.existsSync(dbPath)).toBe(true);
    });
  });
  
  describe('parseSqlContent', () => {
    it('should parse SQL statements correctly', () => {
      const MigrationParser = require('../../src/services/migrationParser');
      
      const sql = `
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE INDEX idx_users ON users(id);
        INSERT INTO users (id) VALUES (1);
      `;
      
      const statements = MigrationParser.parseSqlContent(sql);
      
      expect(statements.length).toBe(3);
      expect(statements[0]).toContain('CREATE TABLE users');
      expect(statements[1]).toContain('CREATE INDEX');
      expect(statements[2]).toContain('INSERT INTO');
    });
    
    it('should handle comments correctly', () => {
      const MigrationParser = require('../../src/services/migrationParser');
      
      const sql = `
        -- This is a comment
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        /* Another comment */
        CREATE INDEX idx_users ON users(id);
      `;
      
      const statements = MigrationParser.parseSqlContent(sql);
      
      expect(statements.length).toBe(2);
    });
  });
  
  describe('validateMigrationSyntax', () => {
    it('should validate valid SQL syntax', async () => {
      const originalTempDir = process.env.TEMP_DIR;
      process.env.TEMP_DIR = tempDir;
      
      const validSql = 'CREATE TABLE test (id INTEGER PRIMARY KEY);';
      
      const result = await DryRunChecker.validateMigrationSyntax(validSql);
      
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      
      process.env.TEMP_DIR = originalTempDir;
    });
    
    it('should detect invalid SQL syntax', async () => {
      const originalTempDir = process.env.TEMP_DIR;
      process.env.TEMP_DIR = tempDir;
      
      const invalidSql = 'INVALID SQL STATEMENT;';
      
      const result = await DryRunChecker.validateMigrationSyntax(invalidSql);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      process.env.TEMP_DIR = originalTempDir;
    });
  });
  
  describe('executeMigrationOnDb', () => {
    it('should execute SQL statements in transaction', async () => {
      const dbPath = path.join(tempDir, 'test-exec.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      const result = await DryRunChecker.executeMigrationOnDb(dbPath, `
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
        INSERT INTO users (id, name) VALUES (1, 'Test User');
      `);
      
      expect(result.every(r => r.success)).toBe(true);
    });
    
    it('should rollback on error', async () => {
      const dbPath = path.join(tempDir, 'test-rollback.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      try {
        await DryRunChecker.executeMigrationOnDb(dbPath, `
          CREATE TABLE users (id INTEGER PRIMARY KEY);
          INVALID STATEMENT;
        `);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeDefined();
      }
    });
  });
});
