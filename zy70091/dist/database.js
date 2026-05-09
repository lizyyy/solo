"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnection = void 0;
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
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
let sqlJsModule = null;
async function initSqlJsModule() {
    if (!sqlJsModule) {
        sqlJsModule = await (0, sql_js_1.default)();
    }
    return sqlJsModule;
}
class DatabaseConnection {
    constructor(dbPath) {
        this.dbPath = dbPath || path_1.default.join(process.cwd(), 'parking.db');
    }
    static async getInstanceAsync(dbPath) {
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
        return DatabaseConnection.instance;
    }
    static getInstance(dbPath) {
        if (!DatabaseConnection.instance) {
            if (!sqlJsModule) {
                throw new Error('sql.js 模块未初始化，请先调用 getInstanceAsync()');
            }
            DatabaseConnection.instance = new DatabaseConnection(dbPath);
            DatabaseConnection.instance.initSchemaSync();
        }
        return DatabaseConnection.instance;
    }
    async initSchema() {
        const SQL = await initSqlJsModule();
        let data = null;
        if (fs_1.default.existsSync(this.dbPath)) {
            const fileBuffer = fs_1.default.readFileSync(this.dbPath);
            data = new Uint8Array(fileBuffer);
        }
        this.db = new SQL.Database(data);
        this.db.run(SCHEMA_SQL);
    }
    initSchemaSync() {
        let data = null;
        if (fs_1.default.existsSync(this.dbPath)) {
            const fileBuffer = fs_1.default.readFileSync(this.dbPath);
            data = new Uint8Array(fileBuffer);
        }
        this.db = new sqlJsModule.Database(data);
        this.db.run(SCHEMA_SQL);
    }
    saveToDisk() {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs_1.default.writeFileSync(this.dbPath, buffer);
    }
    getDatabase() {
        return this.db;
    }
    close() {
        this.saveToDisk();
        this.db.close();
    }
    prepare(sql) {
        return this.db.prepare(sql);
    }
    exec(sql) {
        this.db.run(sql);
    }
    transaction(fn) {
        this.db.run('BEGIN TRANSACTION');
        try {
            const result = fn();
            this.db.run('COMMIT');
            this.saveToDisk();
            return result;
        }
        catch (e) {
            this.db.run('ROLLBACK');
            throw e;
        }
    }
    static reset() {
        DatabaseConnection.instance = null;
        DatabaseConnection.initPromise = null;
    }
    static setInitializedModule(module) {
        sqlJsModule = module;
    }
}
exports.DatabaseConnection = DatabaseConnection;
DatabaseConnection.instance = null;
DatabaseConnection.initPromise = null;
exports.default = DatabaseConnection;
//# sourceMappingURL=database.js.map