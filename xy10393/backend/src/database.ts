import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

let dbInstance: SqlJsDatabase | null = null;
let SQL: typeof initSqlJs.SqlJsStatic | null = null;
const dbPath = path.join(__dirname, '..', 'cycling.db');

async function initDb(): Promise<SqlJsDatabase> {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  if (dbInstance) return dbInstance;
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(buffer);
  } else {
    dbInstance = new SQL.Database();
  }
  
  return dbInstance;
}

export async function getDb(): Promise<SqlJsDatabase> {
  if (!dbInstance) {
    await initDb();
  }
  return dbInstance!;
}

export function saveDb() {
  if (dbInstance && SQL) {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

export async function initializeDatabase() {
  const db = await getDb();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS riders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      bib_number INTEGER UNIQUE NOT NULL,
      team TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      status TEXT NOT NULL DEFAULT 'registered',
      registered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      location TEXT,
      is_start INTEGER NOT NULL DEFAULT 0,
      is_finish INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS equipment_checks (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      checked_at TEXT NOT NULL,
      items TEXT NOT NULL,
      overall_result TEXT NOT NULL,
      checker_name TEXT NOT NULL,
      comments TEXT,
      FOREIGN KEY (rider_id) REFERENCES riders(id)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      checkpoint_id TEXT NOT NULL,
      checked_in_at TEXT NOT NULL,
      checked_by TEXT NOT NULL,
      FOREIGN KEY (rider_id) REFERENCES riders(id),
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
    );

    CREATE TABLE IF NOT EXISTS dropouts (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      checkpoint_id TEXT,
      dropped_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      comments TEXT,
      recorded_by TEXT NOT NULL,
      FOREIGN KEY (rider_id) REFERENCES riders(id),
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
    );

    CREATE TABLE IF NOT EXISTS supplies (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      supply_type TEXT NOT NULL,
      checkpoint_id TEXT,
      collected_at TEXT NOT NULL,
      collected_by TEXT NOT NULL,
      FOREIGN KEY (rider_id) REFERENCES riders(id),
      FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
    );

    CREATE TABLE IF NOT EXISTS approval_comments (
      id TEXT PRIMARY KEY,
      related_type TEXT NOT NULL,
      related_id TEXT NOT NULL,
      action TEXT NOT NULL,
      decision TEXT NOT NULL,
      comments TEXT NOT NULL,
      made_by TEXT NOT NULL,
      made_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS finish_records (
      id TEXT PRIMARY KEY,
      rider_id TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      total_time REAL,
      recorded_by TEXT NOT NULL,
      FOREIGN KEY (rider_id) REFERENCES riders(id)
    );
  `);
  
  saveDb();
}

export async function dbRun(sql: string, ...params: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
  const db = await getDb();
  db.run(sql, params);
  saveDb();
  return { lastInsertRowid: 0, changes: db.getRowsModified() };
}

export async function dbAll(sql: string, ...params: any[]): Promise<any[]> {
  const db = await getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export async function dbGet(sql: string, ...params: any[]): Promise<any | undefined> {
  const rows = await dbAll(sql, ...params);
  return rows[0];
}
