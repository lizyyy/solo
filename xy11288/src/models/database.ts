import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = './exhibition_materials.db';

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initTables();
  }

  private initTables(): void {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS materials (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          specs TEXT NOT NULL,
          totalQuantity INTEGER NOT NULL DEFAULT 0,
          availableQuantity INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'normal',
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS booths (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          exhibitor TEXT NOT NULL,
          contact TEXT,
          createdAt INTEGER NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS borrow_records (
          id TEXT PRIMARY KEY,
          requestId TEXT NOT NULL,
          materialId TEXT NOT NULL,
          materialCode TEXT NOT NULL,
          fromBoothId TEXT,
          toBoothId TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          status TEXT NOT NULL,
          operatorId TEXT NOT NULL,
          operatorName TEXT NOT NULL,
          operatorRole TEXT NOT NULL,
          operationType TEXT NOT NULL,
          reason TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          returnedAt INTEGER,
          damagedQuantity INTEGER
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          requestId TEXT NOT NULL,
          operationType TEXT NOT NULL,
          operatorId TEXT NOT NULL,
          operatorName TEXT NOT NULL,
          operatorRole TEXT NOT NULL,
          result TEXT NOT NULL,
          reason TEXT NOT NULL,
          requestData TEXT NOT NULL,
          responseData TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS idempotent_requests (
          requestId TEXT PRIMARY KEY,
          operationType TEXT NOT NULL,
          operatorId TEXT NOT NULL,
          status TEXT NOT NULL,
          resultData TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          completedAt INTEGER
        )
      `);

      this.db.run(`
        CREATE TABLE IF NOT EXISTS damage_reports (
          id TEXT PRIMARY KEY,
          recordId TEXT NOT NULL,
          materialId TEXT NOT NULL,
          boothId TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          damageType TEXT NOT NULL,
          description TEXT,
          deductionAmount REAL NOT NULL DEFAULT 0,
          operatorId TEXT NOT NULL,
          createdAt INTEGER NOT NULL
        )
      `);

      this.db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_requestId ON borrow_records(requestId)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_material ON borrow_records(materialId)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_booth ON borrow_records(toBoothId)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_requestId ON audit_logs(requestId)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operatorId)`);
    });
  }

  public run(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  public all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  public close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const db = new Database();
