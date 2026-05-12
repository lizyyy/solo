import initSqlJs from 'sql.js';
import fs from 'fs-extra';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'tickets.db');

let dbInstance: any = null;
let SQL: any = null;

export async function getDb(): Promise<any> {
  if (dbInstance) return dbInstance;
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }
  
  initializeSchema(dbInstance);
  
  return dbInstance;
}

function initializeSchema(db: any): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      ticket_code TEXT UNIQUE NOT NULL,
      event_id TEXT NOT NULL,
      event_name TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      original_holder_id TEXT NOT NULL,
      original_holder_name TEXT NOT NULL,
      ticket_type TEXT NOT NULL,
      package_id TEXT,
      package_name TEXT,
      package_sequence INTEGER,
      package_total INTEGER,
      price REAL NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      valid_from INTEGER NOT NULL,
      valid_until INTEGER NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_transfers (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      from_holder_id TEXT NOT NULL,
      from_holder_name TEXT NOT NULL,
      to_holder_id TEXT NOT NULL,
      to_holder_name TEXT NOT NULL,
      status TEXT NOT NULL,
      request_time INTEGER NOT NULL,
      completed_time INTEGER,
      reason TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_refunds (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      status TEXT NOT NULL,
      request_time INTEGER NOT NULL,
      completed_time INTEGER,
      reason TEXT NOT NULL,
      refund_amount REAL NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS validation_records (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      ticket_code TEXT NOT NULL,
      holder_id TEXT NOT NULL,
      holder_name TEXT NOT NULL,
      source TEXT NOT NULL,
      gate_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      offline_package_id TEXT,
      validation_time INTEGER NOT NULL,
      server_time INTEGER NOT NULL,
      status TEXT NOT NULL,
      failure_reason TEXT,
      request_id TEXT UNIQUE NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS offline_packages (
      id TEXT PRIMARY KEY,
      package_id TEXT UNIQUE NOT NULL,
      gate_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      valid_from INTEGER NOT NULL,
      valid_until INTEGER NOT NULL,
      uploaded_at INTEGER,
      upload_status TEXT NOT NULL,
      validation_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS offline_validation_items (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      ticket_code TEXT NOT NULL,
      gate_id TEXT NOT NULL,
      validation_time INTEGER NOT NULL,
      processed INTEGER NOT NULL DEFAULT 0,
      processed_result TEXT,
      failure_reason TEXT
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      ticket_id TEXT,
      transfer_id TEXT,
      refund_id TEXT,
      validation_id TEXT,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      action TEXT NOT NULL,
      before_state TEXT,
      after_state TEXT,
      diff TEXT,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      endpoint TEXT NOT NULL,
      request_body TEXT NOT NULL,
      response_body TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `);
  
  saveDatabase(db);
}

function saveDatabase(db: any): void {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function run(db: any, sql: string, params: any[] = []): { changes: number } {
  db.run(sql, params);
  saveDatabase(db);
  return { changes: 1 };
}

export function get(db: any, sql: string, params: any[] = []): any | null {
  const result = db.exec(sql, params);
  if (!result.length || !result[0].values.length) return null;
  
  const columns = result[0].columns;
  const values = result[0].values[0];
  
  const row: Record<string, any> = {};
  columns.forEach((col: string, idx: number) => {
    row[col] = values[idx];
  });
  
  return row;
}

export function all(db: any, sql: string, params: any[] = []): any[] {
  const result = db.exec(sql, params);
  if (!result.length) return [];
  
  const columns = result[0].columns;
  
  return result[0].values.map((values: any[]) => {
    const row: Record<string, any> = {};
    columns.forEach((col: string, idx: number) => {
      row[col] = values[idx];
    });
    return row;
  });
}

export function closeDatabase(): void {
  if (dbInstance) {
    saveDatabase(dbInstance);
    dbInstance.close();
    dbInstance = null;
  }
}
