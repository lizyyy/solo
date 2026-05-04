const HealthChecker = require('../../src/services/healthChecker');
const DryRunChecker = require('../../src/services/dryRunChecker');
const path = require('path');
const temp = require('temp');

temp.track();

describe('HealthChecker', () => {
  let tempDir;
  
  beforeEach(() => {
    tempDir = temp.mkdirSync('health-test-');
  });
  
  afterEach(() => {
    temp.cleanupSync();
  });
  
  describe('getDatabaseState', () => {
    it('should get state of empty database', async () => {
      const dbPath = path.join(tempDir, 'empty.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      const state = await HealthChecker.getDatabaseState(dbPath);
      
      expect(state.tables).toEqual([]);
      expect(state.foreign_keys_enabled).toBe(false);
    });
    
    it('should get state of database with tables', async () => {
      const dbPath = path.join(tempDir, 'with-tables.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      await DryRunChecker.executeMigrationOnDb(dbPath, `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        );
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          author_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          FOREIGN KEY (author_id) REFERENCES users(id)
        );
        CREATE INDEX idx_posts_author ON posts(author_id);
      `);
      
      const state = await HealthChecker.getDatabaseState(dbPath);
      
      expect(state.tables).toContain('users');
      expect(state.tables).toContain('posts');
      
      const usersTable = state.table_details['users'];
      expect(usersTable).toBeDefined();
      expect(usersTable.columns.length).toBe(3);
      
      const postsTable = state.table_details['posts'];
      expect(postsTable.foreign_keys.length).toBe(1);
    });
  });
  
  describe('checkForeignKeys', () => {
    it('should detect foreign keys disabled', async () => {
      const dbPath = path.join(tempDir, 'fk-disabled.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      const result = await HealthChecker.checkForeignKeys(dbPath);
      
      const disabledIssue = result.issues.find(i => i.type === 'foreign_keys_disabled');
      expect(disabledIssue).toBeDefined();
      expect(disabledIssue.severity).toBe('high');
    });
    
    it('should check nullable foreign keys', async () => {
      const dbPath = path.join(tempDir, 'nullable-fk.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      await DryRunChecker.executeMigrationOnDb(dbPath, `
        PRAGMA foreign_keys = ON;
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          author_id INTEGER,
          FOREIGN KEY (author_id) REFERENCES users(id)
        );
      `);
      
      const result = await HealthChecker.checkForeignKeys(dbPath);
      
      const nullableFk = result.issues.find(i => i.type === 'nullable_foreign_key');
      expect(nullableFk).toBeDefined();
      expect(nullableFk.severity).toBe('medium');
    });
  });
  
  describe('checkIndices', () => {
    it('should detect tables without primary keys', async () => {
      const dbPath = path.join(tempDir, 'no-pk.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      await DryRunChecker.executeMigrationOnDb(dbPath, `
        CREATE TABLE logs (
          message TEXT,
          created_at DATETIME
        );
      `);
      
      const result = await HealthChecker.checkIndices(dbPath);
      
      const noPkIssue = result.issues.find(i => i.type === 'no_primary_key');
      expect(noPkIssue).toBeDefined();
      expect(noPkIssue.table).toBe('logs');
    });
  });
  
  describe('checkAll', () => {
    it('should run all health checks', async () => {
      const dbPath = path.join(tempDir, 'check-all.db');
      await DryRunChecker.createEmptyDb(dbPath);
      
      await DryRunChecker.executeMigrationOnDb(dbPath, `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
      
      const result = await HealthChecker.checkAll(dbPath);
      
      expect(result.valid).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });
  
  describe('analyzeMigrationChanges', () => {
    it('should analyze changes between states', () => {
      const beforeState = {
        tables: ['users'],
        table_details: {
          users: {
            columns: [
              { name: 'id', type: 'INTEGER', notnull: false, pk: 1 },
              { name: 'name', type: 'TEXT', notnull: false, pk: 0 }
            ]
          }
        }
      };
      
      const afterState = {
        tables: ['users', 'posts'],
        table_details: {
          users: {
            columns: [
              { name: 'id', type: 'INTEGER', notnull: false, pk: 1 },
              { name: 'name', type: 'TEXT', notnull: true, pk: 0 },
              { name: 'email', type: 'TEXT', notnull: false, pk: 0 }
            ]
          },
          posts: {
            columns: [
              { name: 'id', type: 'INTEGER', notnull: false, pk: 1 },
              { name: 'title', type: 'TEXT', notnull: true, pk: 0 }
            ]
          }
        }
      };
      
      const changes = HealthChecker.analyzeMigrationChanges(beforeState, afterState);
      
      expect(changes.tables_added).toContain('posts');
      expect(changes.tables_modified).toContain('users');
    });
  });
});
