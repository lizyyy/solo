import { Database } from 'sqlite3';
import { initDatabase } from './init';
import { v4 as uuidv4 } from 'uuid';

export interface RunResult {
  lastID: number;
  changes: number;
}

export class DatabaseHelper {
  private db: Database;

  constructor(dbPath?: string) {
    this.db = initDatabase(dbPath);
  }

  run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err: Error | null) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  runWithResult(sql: string, params: any[] = []): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: any) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  beginTransaction(): Promise<void> {
    return this.run('BEGIN IMMEDIATE');
  }

  commit(): Promise<void> {
    return this.run('COMMIT');
  }

  rollback(): Promise<void> {
    return this.run('ROLLBACK');
  }

  close(): void {
    this.db.close();
  }

  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await fn();
      await this.commit();
      return result;
    } catch (error) {
      try {
        await this.rollback();
      } catch (rollbackError) {
        console.error('回滚事务失败:', rollbackError);
      }
      throw error;
    }
  }

  async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.withTransaction(fn);
  }

  static generateId(): string {
    return uuidv4();
  }

  static now(): string {
    return new Date().toISOString();
  }
}
