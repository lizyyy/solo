"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
exports.initializeDatabase = initializeDatabase;
exports.databaseExists = databaseExists;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DEFAULT_DB_PATH = path_1.default.join(process.cwd(), 'budget.db');
let dbInstance = null;
function getDatabase(dbPath = DEFAULT_DB_PATH) {
    if (!dbInstance) {
        const dbDir = path_1.default.dirname(dbPath);
        if (!fs_1.default.existsSync(dbDir)) {
            fs_1.default.mkdirSync(dbDir, { recursive: true });
        }
        dbInstance = new better_sqlite3_1.default(dbPath);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('foreign_keys = ON');
    }
    return dbInstance;
}
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
function initializeDatabase(dbPath = DEFAULT_DB_PATH, force = false) {
    if (force && fs_1.default.existsSync(dbPath)) {
        fs_1.default.unlinkSync(dbPath);
        console.log(`已删除旧数据库: ${dbPath}`);
    }
    const db = getDatabase(dbPath);
    db.exec(`
    -- 部门表
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 预算表
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      department_id TEXT NOT NULL,
      period TEXT NOT NULL,
      budget_type TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      reserved_amount REAL NOT NULL DEFAULT 0,
      threshold REAL NOT NULL DEFAULT 0.8,
      status TEXT NOT NULL DEFAULT 'active',
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      UNIQUE(department_id, period, budget_type)
    );

    -- 采购申请表
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id TEXT PRIMARY KEY,
      request_no TEXT NOT NULL UNIQUE,
      department_id TEXT NOT NULL,
      budget_id TEXT,
      item_name TEXT NOT NULL,
      requested_amount REAL NOT NULL,
      approved_amount REAL,
      status TEXT NOT NULL DEFAULT 'draft',
      request_date TEXT NOT NULL,
      requester TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    );

    -- 合同付款表
    CREATE TABLE IF NOT EXISTS contract_payments (
      id TEXT PRIMARY KEY,
      payment_no TEXT NOT NULL UNIQUE,
      contract_no TEXT,
      department_id TEXT NOT NULL,
      budget_id TEXT,
      purchase_request_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payee TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (budget_id) REFERENCES budgets(id),
      FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id)
    );

    -- 预算变更历史表
    CREATE TABLE IF NOT EXISTS budget_history (
      id TEXT PRIMARY KEY,
      budget_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      amount REAL NOT NULL,
      related_type TEXT,
      related_id TEXT,
      operator TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (budget_id) REFERENCES budgets(id)
    );

    -- 异常记录表
    -- 注意: related_id 是多态关联，不使用外键约束
    -- 可关联: budgets.id, purchase_requests.id, contract_payments.id
    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      exception_type TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'warning',
      related_type TEXT,
      related_id TEXT,
      message TEXT NOT NULL,
      details TEXT,
      is_resolved INTEGER DEFAULT 0,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 导入记录表
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      total_records INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'processing',
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_budgets_department ON budgets(department_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets(period);
    CREATE INDEX IF NOT EXISTS idx_purchase_requests_department ON purchase_requests(department_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_requests_date ON purchase_requests(request_date);
    CREATE INDEX IF NOT EXISTS idx_contract_payments_department ON contract_payments(department_id);
    CREATE INDEX IF NOT EXISTS idx_contract_payments_date ON contract_payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_budget_history_budget ON budget_history(budget_id);
    CREATE INDEX IF NOT EXISTS idx_exceptions_created ON exceptions(created_at);
  `);
    console.log(`数据库初始化完成: ${dbPath}`);
}
function databaseExists(dbPath = DEFAULT_DB_PATH) {
    return fs_1.default.existsSync(dbPath);
}
//# sourceMappingURL=database.js.map