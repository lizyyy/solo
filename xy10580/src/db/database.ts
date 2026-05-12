import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { getAppealDir } from '../utils/config';

let dbInstance: SqlJsDatabase | null = null;
let SQL: any = null;

async function getSQL() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (!dbInstance) {
    const SQL = await getSQL();
    const appealDir = getAppealDir();
    const dbPath = path.join(appealDir, 'appeal.db');
    
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } else {
      dbInstance = new SQL.Database();
    }
  }
  return dbInstance!;
}

export async function saveDb(): Promise<void> {
  if (dbInstance) {
    const appealDir = getAppealDir();
    const dbPath = path.join(appealDir, 'appeal.db');
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export function closeDb(): void {
  if (dbInstance) {
    saveDb();
    dbInstance.close();
    dbInstance = null;
  }
}

export async function isDatabaseInitialized(): Promise<boolean> {
  try {
    const appealDir = getAppealDir();
    const dbPath = path.join(appealDir, 'appeal.db');
    if (!fs.existsSync(dbPath)) {
      return false;
    }
    
    const SQL = await getSQL();
    const fileBuffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(fileBuffer);
    
    const result = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='orders'"
    );
    db.close();
    
    return result.length > 0 && result[0].values.length > 0;
  } catch {
    return false;
  }
}

export async function initDatabase(): Promise<void> {
  const db = await getDb();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      rider_id TEXT NOT NULL,
      rider_name TEXT NOT NULL,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      merchant_address TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      estimated_delivery_time INTEGER NOT NULL,
      actual_delivery_time INTEGER,
      promised_time INTEGER NOT NULL,
      create_time INTEGER NOT NULL,
      accept_time INTEGER,
      arrive_merchant_time INTEGER,
      pick_up_time INTEGER,
      deliver_time INTEGER,
      status TEXT NOT NULL,
      cancel_reason TEXT,
      cancel_time INTEGER,
      cancel_initiator TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rider_trajectories (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      rider_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      accuracy REAL,
      event_type TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(order_no, timestamp, rider_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS merchant_meals (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL,
      expected_ready_time INTEGER NOT NULL,
      actual_ready_time INTEGER NOT NULL,
      prepare_start_time INTEGER,
      note TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weather_events (
      id TEXT PRIMARY KEY,
      city TEXT NOT NULL,
      region TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      weather_type TEXT NOT NULL,
      description TEXT NOT NULL,
      intensity TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS platform_penalties (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      rider_id TEXT NOT NULL,
      penalty_type TEXT NOT NULL,
      penalty_amount REAL NOT NULL,
      penalty_reason TEXT NOT NULL,
      create_time INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      reverted_amount REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      rider_id TEXT NOT NULL,
      appeal_type TEXT NOT NULL,
      appeal_reason TEXT NOT NULL,
      submit_time INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      check_result TEXT,
      check_evidence TEXT,
      check_time INTEGER,
      reverted_amount REAL DEFAULT 0,
      operator TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appeal_corrections (
      id TEXT PRIMARY KEY,
      appeal_id TEXT NOT NULL,
      operator TEXT NOT NULL,
      before_status TEXT NOT NULL,
      after_status TEXT NOT NULL,
      before_reverted_amount REAL,
      after_reverted_amount REAL,
      before_check_result TEXT,
      after_check_result TEXT,
      reason TEXT NOT NULL,
      create_time INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appeal_histories (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL,
      appeal_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT,
      from_status TEXT,
      to_status TEXT,
      details TEXT,
      create_time INTEGER NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trajectories_order_no ON rider_trajectories(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trajectories_rider_id ON rider_trajectories(rider_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_trajectories_timestamp ON rider_trajectories(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_order_no ON appeals(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_rider_id ON appeals(rider_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_order_no ON appeal_histories(order_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_appeal_id ON appeal_histories(appeal_id)`);

  await saveDb();
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeParams(params: any[]): any[] {
  return params.map(p => p === undefined ? null : p);
}

export async function dbPrepare(sql: string) {
  const db = await getDb();
  return {
    run: async (...params: any[]) => {
      db.run(sql, sanitizeParams(params));
      await saveDb();
      return { changes: db.getRowsModified() };
    },
    get: async (...params: any[]) => {
      const cleanParams = sanitizeParams(params);
      const stmt = db.prepare(sql);
      stmt.bind(cleanParams);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: async (...params: any[]) => {
      const cleanParams = sanitizeParams(params);
      const results = db.exec(sql, cleanParams);
      if (results.length === 0) return [];
      const columns = results[0].columns;
      return results[0].values.map(row => {
        const obj: Record<string, any> = {};
        columns.forEach((col: string, idx: number) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
  };
}
