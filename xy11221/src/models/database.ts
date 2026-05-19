import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = './data/quality_control.db';

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.initTables();
  }

  private initTables(): void {
    const tables = [
      `CREATE TABLE IF NOT EXISTS sample_retention (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        dish_name TEXT NOT NULL,
        dish_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reserved_by TEXT NOT NULL,
        reserved_at TEXT NOT NULL,
        storage_location TEXT NOT NULL,
        discard_date TEXT NOT NULL,
        discarded_by TEXT,
        discarded_at TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        remarks TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS temperature_log (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        refrigerator_id TEXT NOT NULL,
        refrigerator_name TEXT NOT NULL,
        temperature REAL NOT NULL,
        min_temperature REAL NOT NULL,
        max_temperature REAL NOT NULL,
        measured_by TEXT NOT NULL,
        measured_at TEXT NOT NULL,
        is_normal INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        remarks TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS discard_record (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL,
        discard_reason TEXT NOT NULL,
        discarded_by TEXT NOT NULL,
        discarded_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        remarks TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS import_record (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        import_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        total_records INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        imported_by TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS failed_record (
        id TEXT PRIMARY KEY,
        import_id TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        original_data TEXT NOT NULL,
        error_message TEXT NOT NULL,
        suggestion TEXT NOT NULL,
        is_resolved INTEGER NOT NULL DEFAULT 0,
        resolved_at TEXT,
        created_at TEXT NOT NULL
      )`
    ];

    tables.forEach(sql => this.db.run(sql));
  }

  run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row as T);
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  generateId(): string {
    return uuidv4();
  }

  now(): string {
    return new Date().toISOString();
  }
}

export const db = new Database();