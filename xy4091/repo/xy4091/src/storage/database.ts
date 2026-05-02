import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import path from 'path';

let db: SqlJsDatabase | null = null;
let dbPath: string = '';
let isInMemory: boolean = false;

export async function initDatabaseConnection(): Promise<void> {
  if (db) return;
  
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(require.resolve('sql.js'), '..', file)
  });
  
  const envDbPath = process.env.DB_PATH;
  
  if (envDbPath === ':memory:') {
    isInMemory = true;
    dbPath = ':memory:';
    db = new SQL.Database();
  } else {
    isInMemory = false;
    dbPath = envDbPath || path.join(__dirname, '..', '..', 'data', 'bloodbank.db');
    
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  }
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabaseConnection first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (!db || isInMemory) return;
  
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (db) {
    if (!isInMemory) {
      saveDatabase();
    }
    db.close();
    db = null;
  }
}

export function run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const database = getDatabase();
  database.run(sql, params);
  saveDatabase();
  
  const lastIdResult = database.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = lastIdResult.length > 0 && lastIdResult[0].values.length > 0 
    ? Number(lastIdResult[0].values[0][0]) 
    : 0;
  
  const changesResult = database.exec('SELECT changes() as cnt');
  const changes = changesResult.length > 0 && changesResult[0].values.length > 0 
    ? Number(changesResult[0].values[0][0]) 
    : 0;
  
  return { lastInsertRowid, changes };
}

export function get<T = any>(sql: string, params: any[] = []): T | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  let result: T | undefined;
  if (stmt.step()) {
    result = rowToObject(stmt) as T;
  }
  stmt.free();
  return result;
}

export function all<T = any>(sql: string, params: any[] = []): T[] {
  const database = getDatabase();
  const results: T[] = [];
  const stmt = database.prepare(sql);
  stmt.bind(params);
  
  while (stmt.step()) {
    results.push(rowToObject(stmt) as T);
  }
  stmt.free();
  return results;
}

function rowToObject(stmt: initSqlJs.Statement): Record<string, any> {
  const columns = stmt.getColumnNames();
  const values = stmt.get();
  const obj: Record<string, any> = {};
  
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = values[i];
  }
  return obj;
}

export async function initDatabase(): Promise<void> {
  await initDatabaseConnection();
  
  const initSql = `
    CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      floor INTEGER NOT NULL,
      contact_person TEXT,
      contact_phone TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blood_bags (
      id TEXT PRIMARY KEY,
      blood_type TEXT NOT NULL,
      component_type TEXT NOT NULL,
      volume INTEGER NOT NULL,
      donor_id TEXT NOT NULL,
      collection_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      cross_match_status TEXT NOT NULL DEFAULT 'PENDING',
      temperature_records TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      locked_by TEXT,
      locked_until TEXT,
      reserved_for_application_id TEXT,
      issued_to_ward_id TEXT,
      issued_at TEXT,
      received_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL,
      notes TEXT,
      FOREIGN KEY (reserved_for_application_id) REFERENCES applications(id),
      FOREIGN KEY (issued_to_ward_id) REFERENCES wards(id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      ward_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      blood_type TEXT NOT NULL,
      component_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'ROUTINE',
      clinical_diagnosis TEXT NOT NULL,
      special_requirements TEXT,
      cross_match_required INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      matched_blood_bag_ids TEXT NOT NULL DEFAULT '[]',
      reserved_blood_bag_ids TEXT NOT NULL DEFAULT '[]',
      issued_blood_bag_ids TEXT NOT NULL DEFAULT '[]',
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      matched_at TEXT,
      reserved_at TEXT,
      issued_at TEXT,
      cancelled_at TEXT,
      rejected_reason TEXT,
      notes TEXT,
      FOREIGN KEY (ward_id) REFERENCES wards(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      changes TEXT NOT NULL DEFAULT '[]',
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL DEFAULT 'OPERATOR',
      timestamp TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_blood_bags_status ON blood_bags(status);
    CREATE INDEX IF NOT EXISTS idx_blood_bags_type ON blood_bags(blood_type, component_type);
    CREATE INDEX IF NOT EXISTS idx_blood_bags_expiry ON blood_bags(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_applications_ward ON applications(ward_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_wards_code ON wards(code);
  `;
  
  const database = getDatabase();
  database.run(initSql);
  saveDatabase();
}
