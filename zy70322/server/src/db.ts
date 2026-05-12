import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';

let db: Database;

export interface Batch {
  id: string;
  name: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
  description?: string;
}

export interface Tenant {
  id: string;
  batch_id: string;
  tenant_id: string;
  tenant_name: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: string;
  tenant_id: string;
  environment: 'old' | 'new';
  imported_at: string;
  data: string;
}

export interface Diff {
  id: string;
  tenant_id: string;
  type: 'data' | 'permission' | 'task' | 'callback';
  status: 'pending' | 'confirmed' | 'retry' | 'business_decision';
  conclusion?: string;
  created_at: string;
  updated_at: string;
  has_manual_conclusion: number;
}

export interface Callback {
  id: string;
  tenant_id: string;
  service_name: string;
  old_url: string;
  new_url: string;
  is_switched: number;
  switched_at?: string;
}

export interface Task {
  id: string;
  tenant_id: string;
  task_name: string;
  task_type: string;
  is_frozen: number;
  frozen_at?: string;
  unfrozen_at?: string;
}

const DB_PATH = path.join(__dirname, '..', 'migration.db');

function saveDatabase(): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      tenant_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      environment TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      data TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS diffs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      conclusion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      has_manual_conclusion INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS callbacks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      old_url TEXT NOT NULL,
      new_url TEXT NOT NULL,
      is_switched INTEGER NOT NULL DEFAULT 0,
      switched_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      task_type TEXT NOT NULL,
      is_frozen INTEGER NOT NULL DEFAULT 0,
      frozen_at TEXT,
      unfrozen_at TEXT
    )
  `);

  saveDatabase();
}

export function runQuery(sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveDatabase();
}

export function getQuery<T = any>(sql: string, params: any[] = []): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result as T;
  }
  stmt.free();
  return undefined;
}

export function allQuery<T = any>(sql: string, params: any[] = []): T[] {
  const results: T[] = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export { db };
