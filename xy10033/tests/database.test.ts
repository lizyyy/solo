import { getDatabase, closeDatabase } from '../src/electron/database';

process.env.NODE_ENV = 'test';

describe('Database', () => {
  beforeEach(() => {
    closeDatabase();
  });

  afterAll(() => {
    closeDatabase();
  });

  it('should connect to database successfully', () => {
    const db = getDatabase();
    expect(db).toBeDefined();
  });

  it('should create all required tables', () => {
    const db = getDatabase();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all() as Array<{ name: string }>;
    
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('reissue_orders');
    expect(tableNames).toContain('reissue_history');
    expect(tableNames).toContain('audit_logs');
    expect(tableNames).toContain('failed_operations');
  });

  it('should support transactions', () => {
    const db = getDatabase();
    const result = db.exec('BEGIN TRANSACTION; COMMIT;');
    expect(result).toBeDefined();
  });
});
