import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'anomaly_explainer.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export interface Transaction {
  id: string;
  transaction_id: string;
  amount: number;
  merchant: string;
  category: string;
  country: string;
  device_id: string;
  user_id: string;
  transaction_time: string;
  is_first_transaction: number;
  is_weekend: number;
  is_night: number;
  velocity_24h: number;
  amount_deviation: number;
  risk_score: number;
  is_anomaly: number;
  created_at: string;
}

export interface Explanation {
  id: string;
  transaction_id: string;
  feature: string;
  feature_value: string;
  contribution: number;
  threshold: string;
  reason: string;
  created_at: string;
}

export interface Review {
  id: string;
  transaction_id: string;
  reviewer: string;
  decision: 'confirmed' | 'rejected';
  comment: string;
  reviewed_at: string;
}

export interface VersionHistory {
  id: string;
  transaction_id: string;
  action: 'import' | 'review' | 'rollback';
  old_value: string;
  new_value: string;
  operator: string;
  created_at: string;
}

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

export default db;
