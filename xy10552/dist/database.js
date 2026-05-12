"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbPath = getDbPath;
exports.getDataDir = getDataDir;
exports.getDb = getDb;
exports.closeDb = closeDb;
exports.initDatabase = initDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let dbInstance = null;
function getDbPath() {
    return path_1.default.join(process.cwd(), '.price-checker', 'data.db');
}
function getDataDir() {
    return path_1.default.join(process.cwd(), '.price-checker');
}
function getDb() {
    if (!dbInstance) {
        const dataDir = getDataDir();
        if (!fs_1.default.existsSync(dataDir)) {
            throw new Error('数据库目录不存在，请先执行 init 命令');
        }
        const dbPath = getDbPath();
        dbInstance = new better_sqlite3_1.default(dbPath);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('foreign_keys = ON');
    }
    return dbInstance;
}
function closeDb() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
function initDatabase() {
    const dataDir = getDataDir();
    if (!fs_1.default.existsSync(dataDir)) {
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = getDbPath();
    const dbExists = fs_1.default.existsSync(dbPath);
    const db = new better_sqlite3_1.default(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      base_price REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS store_prices (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      price REAL NOT NULL,
      effective_from TEXT,
      effective_to TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (sku) REFERENCES products(sku),
      UNIQUE(store_id, sku, effective_from)
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      promotion_name TEXT NOT NULL,
      promotion_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sku) REFERENCES products(sku)
    );

    CREATE TABLE IF NOT EXISTS tag_print_records (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      print_version TEXT NOT NULL,
      printed_price REAL NOT NULL,
      printed_at TEXT NOT NULL,
      printed_by TEXT,
      hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (sku) REFERENCES products(sku),
      UNIQUE(store_id, sku, print_version)
    );

    CREATE TABLE IF NOT EXISTS tag_scans (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      scan_version TEXT NOT NULL,
      scanned_price REAL NOT NULL,
      scanned_at TEXT NOT NULL,
      scanned_by TEXT,
      tag_id TEXT,
      hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (sku) REFERENCES products(sku),
      FOREIGN KEY (tag_id) REFERENCES tag_print_records(id)
    );

    CREATE TABLE IF NOT EXISTS check_results (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      status TEXT NOT NULL,
      system_price REAL,
      store_price REAL,
      printed_price REAL,
      scanned_price REAL,
      effective_promotion_id TEXT,
      check_time TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (scan_id) REFERENCES tag_scans(id),
      FOREIGN KEY (store_id) REFERENCES stores(id),
      FOREIGN KEY (sku) REFERENCES products(sku)
    );

    CREATE TABLE IF NOT EXISTS check_issues (
      id TEXT PRIMARY KEY,
      check_result_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      issue_code TEXT NOT NULL,
      issue_message TEXT NOT NULL,
      severity TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (check_result_id) REFERENCES check_results(id)
    );

    CREATE TABLE IF NOT EXISTS manual_corrections (
      id TEXT PRIMARY KEY,
      check_result_id TEXT NOT NULL,
      corrected_by TEXT NOT NULL,
      old_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      comment TEXT,
      diff_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (check_result_id) REFERENCES check_results(id)
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      check_result_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (check_result_id) REFERENCES check_results(id)
    );

    CREATE INDEX IF NOT EXISTS idx_scans_store_sku ON tag_scans(store_id, sku);
    CREATE INDEX IF NOT EXISTS idx_promotions_sku_time ON promotions(sku, effective_from, effective_to);
    CREATE INDEX IF NOT EXISTS idx_store_prices_time ON store_prices(effective_from, effective_to);
    CREATE INDEX IF NOT EXISTS idx_check_results_status ON check_results(status);
    CREATE INDEX IF NOT EXISTS idx_check_issues_type ON check_issues(issue_type);
  `);
    db.close();
}
