"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataDir = path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path_1.default.join(dataDir, 'anomaly_explainer.db');
const db = new better_sqlite3_1.default(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    transaction_id TEXT UNIQUE NOT NULL,
    amount REAL NOT NULL,
    merchant TEXT,
    category TEXT,
    country TEXT,
    device_id TEXT,
    user_id TEXT,
    transaction_time TEXT NOT NULL,
    is_first_transaction INTEGER DEFAULT 0,
    is_weekend INTEGER DEFAULT 0,
    is_night INTEGER DEFAULT 0,
    velocity_24h INTEGER DEFAULT 0,
    amount_deviation REAL DEFAULT 0,
    risk_score REAL NOT NULL,
    is_anomaly INTEGER DEFAULT 0,
    reviewed INTEGER DEFAULT 0,
    review_decision TEXT,
    review_comment TEXT,
    reviewer TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS explanations (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    feature_value TEXT,
    contribution REAL NOT NULL,
    threshold TEXT,
    reason TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS version_history (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_anomaly ON transactions(is_anomaly, reviewed);
  CREATE INDEX IF NOT EXISTS idx_transactions_score ON transactions(risk_score DESC);
  CREATE INDEX IF NOT EXISTS idx_explanations_transaction ON explanations(transaction_id);
  CREATE INDEX IF NOT EXISTS idx_version_transaction ON version_history(transaction_id);
`);
exports.default = db;
