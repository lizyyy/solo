import initSqlJs, { Database, SqlValue, SqlJsStatic } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

const DB_FILE = path.resolve(__dirname, '..', 'delivery_service.db');

let db: Database | null = null;
let SQL: SqlJsStatic | null = null;

export const initDb = async (): Promise<void> => {
  SQL = await initSqlJs();
  
  let dbData: Uint8Array | null = null;
  if (fs.existsSync(DB_FILE)) {
    dbData = fs.readFileSync(DB_FILE);
  }
  
  db = new SQL.Database(dbData);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      merchant_id TEXT NOT NULL,
      merchant_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rider_id TEXT,
      rider_name TEXT,
      order_amount REAL NOT NULL,
      status TEXT NOT NULL,
      expected_meal_minutes INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_nodes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      node_type TEXT NOT NULL,
      node_status TEXT NOT NULL,
      operator_id TEXT,
      operator_role TEXT,
      remark TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS meal_timers (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      expected_meal_minutes INTEGER NOT NULL,
      actual_meal_minutes REAL,
      is_overtime INTEGER NOT NULL DEFAULT 0,
      overtime_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS liability_judgments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      meal_timer_id TEXT NOT NULL,
      liable_party TEXT NOT NULL,
      judgment_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (meal_timer_id) REFERENCES meal_timers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS compensations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      liability_judgment_id TEXT NOT NULL,
      compensation_type TEXT NOT NULL,
      target_party TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      remark TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (liability_judgment_id) REFERENCES liability_judgments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS appeals (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      compensation_id TEXT NOT NULL,
      appellant_party TEXT NOT NULL,
      appellant_id TEXT NOT NULL,
      appeal_reason TEXT NOT NULL,
      appeal_evidence TEXT,
      status TEXT NOT NULL,
      reviewer_id TEXT,
      review_result TEXT,
      created_at INTEGER NOT NULL,
      reviewed_at INTEGER,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (compensation_id) REFERENCES compensations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id TEXT PRIMARY KEY,
      request_key TEXT UNIQUE NOT NULL,
      request_type TEXT NOT NULL,
      response_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      operator_role TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operation_detail TEXT,
      old_data TEXT,
      new_data TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_order_nodes_order_id ON order_nodes(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_meal_timers_order_id ON meal_timers(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_liability_judgments_order_id ON liability_judgments(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_compensations_order_id ON compensations(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appeals_order_id ON appeals(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_operation_logs_order_id ON operation_logs(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_idempotent_requests_key ON idempotent_requests(request_key)`);
};

export const saveDatabase = (): void => {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
};

export const getDb = (): Database => {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
};

export const generateId = (): string => {
  return uuidv4();
};

export const now = (): number => {
  return Date.now();
};

export const convertRowToObject = (columnNames: string[], row: SqlValue[]): Record<string, any> => {
  const obj: Record<string, any> = {};
  columnNames.forEach((name, index) => {
    obj[name] = row[index];
  });
  return obj;
};

export const convertRowsToObjects = (columnNames: string[], rows: SqlValue[][]): Record<string, any>[] => {
  return rows.map(row => convertRowToObject(columnNames, row));
};

export const executeGet = <T = any>(query: string, params: SqlValue[] = []): T | null => {
  const stmt = getDb().prepare(query);
  stmt.bind(params);
  
  if (stmt.step()) {
    const row = stmt.get();
    const columnNames = stmt.getColumnNames();
    stmt.free();
    return convertRowToObject(columnNames, row) as T;
  }
  
  stmt.free();
  return null;
};

export const executeAll = <T = any>(query: string, params: SqlValue[] = []): T[] => {
  const stmt = getDb().prepare(query);
  stmt.bind(params);
  
  const columnNames = stmt.getColumnNames();
  const results: T[] = [];
  
  while (stmt.step()) {
    const row = stmt.get();
    results.push(convertRowToObject(columnNames, row) as T);
  }
  
  stmt.free();
  return results;
};
