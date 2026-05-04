const MigrationParser = require('../../src/services/migrationParser');

describe('MigrationParser', () => {
  describe('parseVersion', () => {
    it('should parse timestamp format', () => {
      const result = MigrationParser.parseVersion('20240115123000');
      expect(result.type).toBe('timestamp');
      expect(result.numeric).toBe(20240115123000);
      expect(result.date).toBe('2024-01-15T12:30:00Z');
    });

    it('should parse semver format', () => {
      const result = MigrationParser.parseVersion('1.2.3');
      expect(result.type).toBe('semver');
      expect(result.major).toBe(1);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(3);
      expect(result.numeric).toBe(1002003);
    });

    it('should parse semver with v prefix', () => {
      const result = MigrationParser.parseVersion('v2.0.0');
      expect(result.type).toBe('semver');
      expect(result.major).toBe(2);
    });

    it('should parse numeric format', () => {
      const result = MigrationParser.parseVersion('0001');
      expect(result.type).toBe('numeric');
      expect(result.numeric).toBe(1);
    });

    it('should parse string format as fallback', () => {
      const result = MigrationParser.parseVersion('initial');
      expect(result.type).toBe('string');
      expect(result.numeric).toBe(-1);
    });
  });

  describe('compareVersions', () => {
    it('should compare timestamps correctly', () => {
      expect(MigrationParser.compareVersions('20240115123000', '20240114123000')).toBeGreaterThan(0);
      expect(MigrationParser.compareVersions('20240114123000', '20240115123000')).toBeLessThan(0);
    });

    it('should compare semver correctly', () => {
      expect(MigrationParser.compareVersions('1.2.3', '1.2.2')).toBeGreaterThan(0);
      expect(MigrationParser.compareVersions('1.2.2', '1.2.3')).toBeLessThan(0);
      expect(MigrationParser.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should compare numeric versions correctly', () => {
      expect(MigrationParser.compareVersions('0010', '0002')).toBeGreaterThan(0);
    });
  });

  describe('sortMigrations', () => {
    it('should sort migrations by version ascending', () => {
      const migrations = [
        { version: '0003' },
        { version: '0001' },
        { version: '0002' }
      ];
      
      const sorted = MigrationParser.sortMigrations(migrations);
      expect(sorted[0].version).toBe('0001');
      expect(sorted[1].version).toBe('0002');
      expect(sorted[2].version).toBe('0003');
    });

    it('should sort migrations by version descending', () => {
      const migrations = [
        { version: '0001' },
        { version: '0003' },
        { version: '0002' }
      ];
      
      const sorted = MigrationParser.sortMigrations(migrations, 'desc');
      expect(sorted[0].version).toBe('0003');
      expect(sorted[1].version).toBe('0002');
      expect(sorted[2].version).toBe('0001');
    });
  });

  describe('parseSqlContent', () => {
    it('should parse multiple statements', () => {
      const sql = `
        CREATE TABLE users (id INTEGER PRIMARY KEY);
        CREATE TABLE posts (id INTEGER PRIMARY KEY);
      `;
      
      const statements = MigrationParser.parseSqlContent(sql);
      expect(statements.length).toBe(2);
      expect(statements[0]).toContain('CREATE TABLE users');
      expect(statements[1]).toContain('CREATE TABLE posts');
    });

    it('should handle comments correctly', () => {
      const sql = `
        -- This is a comment
        CREATE TABLE users (
          id INTEGER PRIMARY KEY -- inline comment
        );
        /* Multi-line
           comment */
        CREATE INDEX idx_users ON users(id);
      `;
      
      const statements = MigrationParser.parseSqlContent(sql);
      expect(statements.length).toBe(2);
      expect(statements[0]).not.toContain('--');
    });

    it('should handle strings with semicolons', () => {
      const sql = `
        INSERT INTO users (name) VALUES ('test; value');
        INSERT INTO users (name) VALUES ("another; test");
      `;
      
      const statements = MigrationParser.parseSqlContent(sql);
      expect(statements.length).toBe(2);
    });
  });

  describe('extractUpDownFromFile', () => {
    it('should extract UP and DOWN sections', () => {
      const content = `
-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY);
CREATE INDEX idx_users ON users(id);
-- DOWN
DROP INDEX IF EXISTS idx_users;
DROP TABLE IF EXISTS users;
      `;
      
      const result = MigrationParser.extractUpDownFromFile(content);
      expect(result.upSql).toContain('CREATE TABLE users');
      expect(result.upSql).toContain('CREATE INDEX');
      expect(result.downSql).toContain('DROP INDEX');
      expect(result.downSql).toContain('DROP TABLE');
    });

    it('should handle UP only content', () => {
      const content = 'CREATE TABLE users (id INTEGER PRIMARY KEY);';
      
      const result = MigrationParser.extractUpDownFromFile(content);
      expect(result.upSql).toContain('CREATE TABLE');
      expect(result.downSql).toBe('');
    });
  });

  describe('detectOperationType', () => {
    it('should detect CREATE TABLE as non-destructive', () => {
      const result = MigrationParser.detectOperationType('CREATE TABLE users (id INTEGER PRIMARY KEY);');
      expect(result.type).toBe('create_table');
      expect(result.destructive).toBe(false);
    });

    it('should detect DROP TABLE as destructive', () => {
      const result = MigrationParser.detectOperationType('DROP TABLE users;');
      expect(result.type).toBe('drop_table');
      expect(result.destructive).toBe(true);
    });

    it('should detect ALTER TABLE DROP COLUMN as destructive', () => {
      const result = MigrationParser.detectOperationType('ALTER TABLE users DROP COLUMN old_col;');
      expect(result.type).toBe('alter_table_drop');
      expect(result.destructive).toBe(true);
    });

    it('should detect ALTER TABLE ADD COLUMN as non-destructive', () => {
      const result = MigrationParser.detectOperationType('ALTER TABLE users ADD COLUMN new_col TEXT;');
      expect(result.type).toBe('alter_table_add');
      expect(result.destructive).toBe(false);
    });

    it('should detect ADD NOT NULL as risky', () => {
      const result = MigrationParser.detectOperationType('ALTER TABLE users ADD COLUMN new_col TEXT NOT NULL;');
      expect(result.type).toBe('alter_table_add_constraint');
      expect(result.risky).toBe(true);
    });
  });

  describe('analyzeMigration', () => {
    it('should analyze migration correctly', () => {
      const migration = {
        id: 'test-123',
        version: '0001',
        name: 'create_users',
        up_sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY);',
        down_sql: 'DROP TABLE IF EXISTS users;'
      };
      
      const result = MigrationParser.analyzeMigration(migration);
      expect(result.migration_id).toBe('test-123');
      expect(result.version).toBe('0001');
      expect(result.has_down).toBe(true);
      expect(result.has_destructive_up).toBe(false);
    });

    it('should detect destructive operations', () => {
      const migration = {
        id: 'test-123',
        version: '0001',
        name: 'drop_tables',
        up_sql: 'DROP TABLE users; DROP TABLE posts;',
        down_sql: ''
      };
      
      const result = MigrationParser.analyzeMigration(migration);
      expect(result.has_destructive_up).toBe(true);
      expect(result.has_down).toBe(false);
    });
  });
});
