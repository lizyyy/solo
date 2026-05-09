import { DatabaseService } from '../src/core/DatabaseService';
import { Logger } from '../src/logging/Logger';
import { DEFAULT_DATABASE_CONFIG } from '../src/config/default';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { unlinkSync, existsSync, mkdirSync } from 'fs';

const TEST_DB_DIR = join(process.cwd(), 'test-data');
const TEST_DB_PATH = join(TEST_DB_DIR, 'test.db');

function ensureTestDir() {
  if (!existsSync(TEST_DB_DIR)) {
    mkdirSync(TEST_DB_DIR, { recursive: true });
  }
}

function cleanupTestDb() {
  if (existsSync(TEST_DB_PATH)) {
    try {
      unlinkSync(TEST_DB_PATH);
    } catch {
      // ignore
    }
  }
  const walPath = `${TEST_DB_PATH}-wal`;
  if (existsSync(walPath)) {
    try {
      unlinkSync(walPath);
    } catch {
      // ignore
    }
  }
  const shmPath = `${TEST_DB_PATH}-shm`;
  if (existsSync(shmPath)) {
    try {
      unlinkSync(shmPath);
    } catch {
      // ignore
    }
  }
}

describe('DatabaseService', () => {
  let logger: Logger;
  let service: DatabaseService;

  beforeAll(() => {
    ensureTestDir();
  });

  beforeEach(() => {
    cleanupTestDb();
    logger = new Logger({ level: 'ERROR', enableConsole: false });
    service = new DatabaseService({
      ...DEFAULT_DATABASE_CONFIG,
      dbPath: TEST_DB_PATH,
      maxPoolSize: 5,
    }, logger);
  });

  afterEach(async () => {
    service.close();
    cleanupTestDb();
  });

  describe('基本操作', () => {
    it('应该能够创建表和插入数据', async () => {
      await service.run(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE
        )
      `);

      const result = await service.run(
        'INSERT INTO test_users (name, email) VALUES (?, ?)',
        ['Test User', 'test@example.com']
      );

      expect(result.changes).toBe(1);
      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('应该能够查询数据', async () => {
      await service.run(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      await service.run(
        'INSERT INTO test_users (name) VALUES (?)',
        ['Test User']
      );

      const user = await service.get<{ id: number; name: string }>(
        'SELECT * FROM test_users WHERE id = ?',
        [1]
      );

      expect(user).toBeDefined();
      expect(user?.name).toBe('Test User');
    });

    it('应该能够更新数据', async () => {
      await service.run(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      await service.run(
        'INSERT INTO test_users (name) VALUES (?)',
        ['Old Name']
      );

      const updateResult = await service.run(
        'UPDATE test_users SET name = ? WHERE id = ?',
        ['New Name', 1]
      );

      expect(updateResult.changes).toBe(1);

      const user = await service.get<{ id: number; name: string }>(
        'SELECT * FROM test_users WHERE id = ?',
        [1]
      );

      expect(user?.name).toBe('New Name');
    });

    it('应该能够删除数据', async () => {
      await service.run(`
        CREATE TABLE test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      await service.run(
        'INSERT INTO test_users (name) VALUES (?)',
        ['Test User']
      );

      const deleteResult = await service.run(
        'DELETE FROM test_users WHERE id = ?',
        [1]
      );

      expect(deleteResult.changes).toBe(1);

      const user = await service.get<{ id: number; name: string }>(
        'SELECT * FROM test_users WHERE id = ?',
        [1]
      );

      expect(user).toBeUndefined();
    });
  });

  describe('事务', () => {
    it('应该能够执行事务', async () => {
      await service.run(`
        CREATE TABLE test_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          balance REAL DEFAULT 0
        )
      `);

      await service.run(
        'INSERT INTO test_accounts (name, balance) VALUES (?, ?)',
        ['Alice', 1000]
      );
      await service.run(
        'INSERT INTO test_accounts (name, balance) VALUES (?, ?)',
        ['Bob', 500]
      );

      await service.transaction(async (tx) => {
        tx.run(
          'UPDATE test_accounts SET balance = balance - ? WHERE id = ?',
          [200, 1]
        );
        tx.run(
          'UPDATE test_accounts SET balance = balance + ? WHERE id = ?',
          [200, 2]
        );
      });

      const alice = await service.get<{ balance: number }>(
        'SELECT balance FROM test_accounts WHERE id = ?',
        [1]
      );
      const bob = await service.get<{ balance: number }>(
        'SELECT balance FROM test_accounts WHERE id = ?',
        [2]
      );

      expect(alice?.balance).toBe(800);
      expect(bob?.balance).toBe(700);
    });

    it('应该能够回滚事务', async () => {
      await service.run(`
        CREATE TABLE test_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          balance REAL DEFAULT 0
        )
      `);

      await service.run(
        'INSERT INTO test_accounts (name, balance) VALUES (?, ?)',
        ['Alice', 1000]
      );

      await expect(
        service.transaction(async (tx) => {
          tx.run(
            'UPDATE test_accounts SET balance = balance - ? WHERE id = ?',
            [200, 1]
          );
          throw new Error('Intentional rollback');
        })
      ).rejects.toThrow('Intentional rollback');

      const alice = await service.get<{ balance: number }>(
        'SELECT balance FROM test_accounts WHERE id = ?',
        [1]
      );

      expect(alice?.balance).toBe(1000);
    });
  });

  describe('日志记录', () => {
    it('应该记录操作', async () => {
      await service.run(`
        CREATE TABLE test_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      logger.clearLogs();

      await service.run(
        'INSERT INTO test_log (name) VALUES (?)',
        ['Test']
      );

      const logs = logger.getAllLogs();
      expect(logs.length).toBeGreaterThan(0);

      const writeLogs = logs.filter(l => l.operationType === 'WRITE');
      expect(writeLogs.length).toBeGreaterThan(0);
    });

    it('应该记录成功和失败', async () => {
      await service.run(`
        CREATE TABLE test_unique (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE
        )
      `);

      logger.clearLogs();

      await service.run(
        'INSERT INTO test_unique (name) VALUES (?)',
        ['Unique']
      );

      await expect(
        service.run(
          'INSERT INTO test_unique (name) VALUES (?)',
          ['Unique']
        )
      ).rejects.toThrow();

      const stats = logger.getStatistics();
      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.successfulOperations).toBeGreaterThan(0);
      expect(stats.failedOperations).toBeGreaterThan(0);
    });
  });
});
