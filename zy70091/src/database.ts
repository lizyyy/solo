import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS parking_records (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL,
  parking_lot_id TEXT NOT NULL,
  parking_lot_name TEXT NOT NULL,
  berth_id TEXT NOT NULL,
  berth_number TEXT NOT NULL,
  entry_time TEXT NOT NULL,
  exit_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  unpaid_amount REAL NOT NULL,
  payment_status TEXT NOT NULL,
  payment_channel TEXT,
  is_recognized_plate INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  batch_id TEXT,
  imported_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_parking_plate ON parking_records(plate_number);
CREATE INDEX IF NOT EXISTS idx_parking_batch ON parking_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_parking_status ON parking_records(payment_status);

CREATE TABLE IF NOT EXISTS plate_recognitions (
  id TEXT PRIMARY KEY,
  parking_record_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  confidence REAL NOT NULL,
  recognition_time TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plate_record ON plate_recognitions(parking_record_id);
CREATE INDEX IF NOT EXISTS idx_plate_number ON plate_recognitions(plate_number);

CREATE TABLE IF NOT EXISTS arrears_groups (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL,
  normalized_plate TEXT NOT NULL,
  total_unpaid_amount REAL NOT NULL,
  record_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  latest_parking_time TEXT NOT NULL,
  first_unpaid_time TEXT NOT NULL,
  merged_record_ids TEXT NOT NULL,
  batch_id TEXT,
  last_collection_time TEXT,
  collection_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arrears_plate ON arrears_groups(normalized_plate);
CREATE INDEX IF NOT EXISTS idx_arrears_status ON arrears_groups(status);

CREATE TABLE IF NOT EXISTS collection_records (
  id TEXT PRIMARY KEY,
  arrears_group_id TEXT NOT NULL,
  plate_number TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_result TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT,
  operator TEXT,
  source TEXT NOT NULL,
  batch_id TEXT,
  triggered_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_collection_arrears ON collection_records(arrears_group_id);
CREATE INDEX IF NOT EXISTS idx_collection_batch ON collection_records(batch_id);

CREATE TABLE IF NOT EXISTS payment_callbacks (
  id TEXT PRIMARY KEY,
  external_order_id TEXT NOT NULL UNIQUE,
  arrears_group_id TEXT,
  plate_number TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_channel TEXT NOT NULL,
  payment_time TEXT NOT NULL,
  callback_time TEXT NOT NULL,
  source TEXT NOT NULL,
  processed INTEGER NOT NULL DEFAULT 0,
  processed_at TEXT,
  batch_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_callback_plate ON payment_callbacks(plate_number);
CREATE INDEX IF NOT EXISTS idx_callback_order ON payment_callbacks(external_order_id);

CREATE TABLE IF NOT EXISTS blacklist_records (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL,
  arrears_group_id TEXT NOT NULL UNIQUE,
  total_unpaid_amount REAL NOT NULL,
  record_count INTEGER NOT NULL,
  added_time TEXT NOT NULL,
  removed_time TEXT,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  sync_status TEXT NOT NULL,
  sync_message TEXT,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_blacklist_plate ON blacklist_records(plate_number);
CREATE INDEX IF NOT EXISTS idx_blacklist_status ON blacklist_records(status);

CREATE TABLE IF NOT EXISTS collection_reports (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  collected_amount REAL NOT NULL,
  pending_amount REAL NOT NULL,
  blacklist_count INTEGER NOT NULL,
  new_arrears_count INTEGER NOT NULL,
  paid_count INTEGER NOT NULL,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_date ON collection_reports(report_date);

CREATE TABLE IF NOT EXISTS operation_history (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  before_data TEXT,
  after_data TEXT,
  reason TEXT,
  operator TEXT,
  source TEXT NOT NULL,
  batch_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_entity ON operation_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_history_batch ON operation_history(batch_id);

CREATE TABLE IF NOT EXISTS batch_operations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  total_count INTEGER NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  result_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_type ON batch_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_batch_status ON batch_operations(status);
`;

interface SqlJsStatement {
  bind(params?: any[]): boolean;
  step(): boolean;
  get(params?: any[]): any[];
  getAsObject(params?: any[]): any;
  run(params?: any[]): void;
  free(): boolean;
}

let sqlJsModule: any = null;

async function initSqlJsModule(): Promise<any> {
  if (!sqlJsModule) {
    sqlJsModule = await initSqlJs();
  }
  return sqlJsModule;
}

export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private static initPromise: Promise<void> | null = null;
  private db!: SqlJsDatabase;
  private dbPath: string;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'parking.db');
  }

  public static async getInstanceAsync(dbPath?: string): Promise<DatabaseConnection> {
    if (!DatabaseConnection.initPromise) {
      DatabaseConnection.initPromise = (async () => {
        await initSqlJsModule();
        if (!DatabaseConnection.instance) {
          DatabaseConnection.instance = new DatabaseConnection(dbPath);
          await DatabaseConnection.instance.initSchema();
        }
      })();
    }
    await DatabaseConnection.initPromise;
    return DatabaseConnection.instance!;
  }

  public static getInstance(dbPath?: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      if (!sqlJsModule) {
        throw new Error('sql.js 模块未初始化，请先调用 getInstanceAsync()');
      }
      DatabaseConnection.instance = new DatabaseConnection(dbPath);
      DatabaseConnection.instance.initSchemaSync();
    }
    return DatabaseConnection.instance;
  }

  private async initSchema(): Promise<void> {
    const SQL = await initSqlJsModule();
    let data: Uint8Array | null = null;
    
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      data = new Uint8Array(fileBuffer);
    }
    
    this.db = new SQL.Database(data);
    this.db.run(SCHEMA_SQL);
  }

  private initSchemaSync(): void {
    let data: Uint8Array | null = null;
    
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      data = new Uint8Array(fileBuffer);
    }
    
    this.db = new sqlJsModule.Database(data);
    this.db.run(SCHEMA_SQL);
  }

  private saveToDisk(): void {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  public getDatabase(): SqlJsDatabase {
    return this.db;
  }

  public close(): void {
    this.saveToDisk();
    this.db.close();
  }

  public prepare(sql: string): SqlJsStatement {
    return this.db.prepare(sql) as any as SqlJsStatement;
  }

  public exec(sql: string): void {
    this.db.run(sql);
  }

  public transaction<T>(fn: () => T): T {
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = fn();
      this.db.run('COMMIT');
      this.saveToDisk();
      return result;
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
  }

  public static reset(): void {
    DatabaseConnection.instance = null;
    DatabaseConnection.initPromise = null;
  }

  public static setInitializedModule(module: any): void {
    sqlJsModule = module;
  }
}

export default DatabaseConnection;
