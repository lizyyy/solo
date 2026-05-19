import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export class DatabaseManager {
  private db: Database.Database;
  private static instance: DatabaseManager;

  private constructor(dbPath?: string) {
    const defaultPath = path.join(process.cwd(), 'data', 'farm_coop.db');
    const finalPath = dbPath || defaultPath;
    
    const dir = path.dirname(finalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(finalPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeTables();
  }

  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath);
    }
    return DatabaseManager.instance;
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_records (
        id TEXT PRIMARY KEY,
        record_no TEXT UNIQUE NOT NULL,
        tractor_no TEXT NOT NULL,
        operator_name TEXT NOT NULL,
        operator_id_card TEXT,
        operator_phone TEXT,
        work_date TEXT NOT NULL,
        work_type TEXT NOT NULL,
        billing_type TEXT NOT NULL,
        hours REAL,
        acreage REAL,
        fuel_used REAL,
        fuel_price REAL,
        hourly_rate REAL,
        acreage_rate REAL,
        remarks TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS billing_results (
        id TEXT PRIMARY KEY,
        record_id TEXT UNIQUE NOT NULL,
        record_no TEXT NOT NULL,
        total_amount REAL NOT NULL,
        hours_cost REAL,
        acreage_cost REAL,
        fuel_cost REAL,
        billed_at TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES work_records(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        bill_no TEXT UNIQUE NOT NULL,
        operator_name TEXT NOT NULL,
        operator_id_card TEXT,
        operator_phone TEXT,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_amount REAL NOT NULL,
        record_count INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        issued_at TEXT,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS bill_items (
        id TEXT PRIMARY KEY,
        bill_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (record_id) REFERENCES work_records(id) ON DELETE CASCADE,
        UNIQUE(bill_id, record_id)
      );

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        batch_no TEXT UNIQUE NOT NULL,
        file_name TEXT,
        total_records INTEGER NOT NULL,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'processing',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_work_records_date ON work_records(work_date);
      CREATE INDEX IF NOT EXISTS idx_work_records_operator ON work_records(operator_name);
      CREATE INDEX IF NOT EXISTS idx_work_records_status ON work_records(status);
      CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(period_start, period_end);
    `);
  }

  public getConnection(): Database.Database {
    return this.db;
  }

  public transaction<T>(fn: (db: Database.Database) => T): T {
    const exec = this.db.transaction(fn);
    return exec(this.db);
  }

  public close(): void {
    this.db.close();
  }
}
