import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

sqlite3.verbose();

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(__dirname, '../data/settlement.db');
const db = new sqlite3.Database(dbPath);

function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function exec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

let initPromise: Promise<void> | null = null;

async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    await exec(`
      CREATE TABLE IF NOT EXISTS courier_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        delivery_fee REAL NOT NULL DEFAULT 1.0,
        return_fee REAL NOT NULL DEFAULT 2.0,
        storage_fee_per_day REAL NOT NULL DEFAULT 0.5,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const tableInfo = await all("PRAGMA table_info(courier_companies)");
    const hasCodeColumn = tableInfo.some((col: any) => col.name === 'code');
    if (!hasCodeColumn) {
      await exec('ALTER TABLE courier_companies ADD COLUMN code TEXT UNIQUE');
    }

    await exec(`
      CREATE TABLE IF NOT EXISTS retention_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courier_company_id INTEGER,
        free_days INTEGER NOT NULL DEFAULT 3,
        storage_fee_per_day REAL NOT NULL DEFAULT 0.5,
        is_global INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (courier_company_id) REFERENCES courier_companies(id)
      );
    `);

    await exec(`
      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_number TEXT NOT NULL UNIQUE,
        courier_company_id INTEGER NOT NULL,
        recipient_name TEXT NOT NULL,
        recipient_phone TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivery_time DATETIME,
        return_time DATETIME,
        retention_days INTEGER DEFAULT 0,
        total_fee REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        return_fee REAL DEFAULT 0,
        storage_fee REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (courier_company_id) REFERENCES courier_companies(id)
      );
    `);

    const retentionTableInfo = await all("PRAGMA table_info(packages)");
    const hasRetentionDays = retentionTableInfo.some((col: any) => col.name === 'retention_days');
    if (!hasRetentionDays) {
      await exec('ALTER TABLE packages ADD COLUMN retention_days INTEGER DEFAULT 0');
    }

    await exec(`
      CREATE TABLE IF NOT EXISTS settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courier_company_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        total_packages INTEGER DEFAULT 0,
        total_fee REAL DEFAULT 0,
        delivery_fee_total REAL DEFAULT 0,
        return_fee_total REAL DEFAULT 0,
        storage_fee_total REAL DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        returned_count INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (courier_company_id) REFERENCES courier_companies(id)
      );
    `);

    const settlementTableInfo = await all("PRAGMA table_info(settlements)");
    const hasPendingCount = settlementTableInfo.some((col: any) => col.name === 'pending_count');
    if (!hasPendingCount) {
      await exec('ALTER TABLE settlements ADD COLUMN pending_count INTEGER DEFAULT 0');
      await exec('ALTER TABLE settlements ADD COLUMN delivered_count INTEGER DEFAULT 0');
      await exec('ALTER TABLE settlements ADD COLUMN returned_count INTEGER DEFAULT 0');
    }

    console.log('数据库初始化完成');
  })();
  
  return initPromise;
}

const database = {
  run,
  get,
  all,
  exec,
  init: initDatabase
};

export default database;
