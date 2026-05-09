import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConfig, LockType } from '../types';
import { isLockError } from '../config/default';

export class DatabaseConnection {
  public readonly id: string;
  private readonly db: Database.Database;
  private readonly config: DatabaseConfig;
  private isInTransaction = false;
  private inUse = false;
  private lastUsedAt = 0;
  private currentLockType: LockType = 'NONE';

  constructor(config: DatabaseConfig, dbPath?: string) {
    this.id = uuidv4();
    this.config = config;
    this.db = new Database(dbPath || config.dbPath, {
      fileMustExist: false,
    });
    this.configureDatabase();
  }

  private configureDatabase(): void {
    const { journalMode, busyTimeout, synchronous, walAutocheckpoint, cacheSize } = this.config;

    this.db.pragma(`journal_mode = ${journalMode}`);
    this.db.pragma(`busy_timeout = ${busyTimeout}`);
    this.db.pragma(`synchronous = ${synchronous}`);
    this.db.pragma(`wal_autocheckpoint = ${walAutocheckpoint}`);
    this.db.pragma(`cache_size = ${cacheSize}`);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_size_limit = 67108864');
  }

  getDatabase(): Database.Database {
    return this.db;
  }

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql);
  }

  exec(sql: string): Database.RunResult {
    this.db.exec(sql);
    return { changes: 0, lastInsertRowid: BigInt(0) };
  }

  run(sql: string, params?: unknown[]): Database.RunResult {
    this.updateLockType('EXCLUSIVE');
    try {
      return params ? this.db.prepare(sql).run(...params) : this.db.prepare(sql).run();
    } finally {
      if (!this.isInTransaction) {
        this.updateLockType('NONE');
      }
    }
  }

  get<T = unknown>(sql: string, params?: unknown[]): T | undefined {
    this.updateLockType('SHARED');
    try {
      return params ? this.db.prepare(sql).get(...params) as T : this.db.prepare(sql).get() as T;
    } finally {
      if (!this.isInTransaction) {
        this.updateLockType('NONE');
      }
    }
  }

  all<T = unknown>(sql: string, params?: unknown[]): T[] {
    this.updateLockType('SHARED');
    try {
      return params ? this.db.prepare(sql).all(...params) as T[] : this.db.prepare(sql).all() as T[];
    } finally {
      if (!this.isInTransaction) {
        this.updateLockType('NONE');
      }
    }
  }

  beginTransaction(): void {
    if (this.isInTransaction) {
      throw new Error('Transaction already in progress');
    }
    this.db.exec('BEGIN IMMEDIATE');
    this.isInTransaction = true;
    this.updateLockType('RESERVED');
  }

  commit(): void {
    if (!this.isInTransaction) {
      throw new Error('No transaction in progress');
    }
    try {
      this.db.exec('COMMIT');
      this.isInTransaction = false;
      this.updateLockType('NONE');
    } catch (error) {
      if (isLockError(error)) {
        throw error;
      }
      this.isInTransaction = false;
      this.updateLockType('NONE');
      throw error;
    }
  }

  rollback(): void {
    if (!this.isInTransaction) {
      throw new Error('No transaction in progress');
    }
    this.db.exec('ROLLBACK');
    this.isInTransaction = false;
    this.updateLockType('NONE');
  }

  isInTransactionState(): boolean {
    return this.isInTransaction;
  }

  acquire(): void {
    this.inUse = true;
    this.lastUsedAt = Date.now();
  }

  release(): void {
    this.inUse = false;
    this.lastUsedAt = Date.now();
  }

  isAvailable(): boolean {
    return !this.inUse && !this.isInTransaction;
  }

  getLastUsedAt(): number {
    return this.lastUsedAt;
  }

  getLockType(): LockType {
    return this.currentLockType;
  }

  private updateLockType(type: LockType): void {
    this.currentLockType = type;
  }

  getWALFileSize(): number {
    try {
      const result = this.db.pragma('wal_autocheckpoint', { simple: true }) as { checkpointed: number }[];
      if (result && result.length > 0 && result[0].checkpointed) {
        return result[0].checkpointed;
      }
    } catch {
      // ignore
    }
    return 0;
  }

  checkpoint(): { busy: number; log: number; checkpointed: number } {
    try {
      const result = this.db.pragma('wal_checkpoint(PASSIVE)', { simple: true }) as { busy: number; log: number; checkpointed: number }[];
      if (result && result.length > 0) {
        return result[0];
      }
    } catch {
      // ignore
    }
    return { busy: 0, log: 0, checkpointed: 0 };
  }

  close(): void {
    if (this.isInTransaction) {
      this.rollback();
    }
    this.db.close();
  }
}
