import { Database } from 'sqlite3';
import { initDatabase } from './init';
import { v4 as uuidv4 } from 'uuid';

export class DatabaseHelper {
  private db: Database;
  private transactionDepth: number = 0;
  private savepointCounter: number = 0;

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
    return this.run('BEGIN TRANSACTION');
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
    if (this.transactionDepth === 0) {
      this.transactionDepth++;
      await this.beginTransaction();
      try {
        const result = await fn();
        await this.commit();
        this.transactionDepth--;
        return result;
      } catch (error) {
        await this.rollback();
        this.transactionDepth--;
        throw error;
      }
    } else {
      const savepointName = `sp_${this.savepointCounter++}`;
      await this.run(`SAVEPOINT ${savepointName}`);
      try {
        const result = await fn();
        await this.run(`RELEASE SAVEPOINT ${savepointName}`);
        return result;
      } catch (error) {
        await this.run(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        throw error;
      }
    }
  }

  static generateId(): string {
    return uuidv4();
  }

  static now(): string {
    return new Date().toISOString();
  }
}
