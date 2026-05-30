import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, '..', 'data.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    direction TEXT NOT NULL,
    counterparty TEXT NOT NULL,
    amount REAL NOT NULL,
    term INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS collaterals (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    trade_id TEXT NOT NULL REFERENCES trades(id),
    bond_code TEXT NOT NULL,
    bond_name TEXT NOT NULL,
    face_value REAL NOT NULL,
    quantity REAL NOT NULL,
    maturity_date TEXT NOT NULL,
    replacement_bond_code TEXT,
    replacement_status TEXT NOT NULL DEFAULT '无替换',
    source TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS discount_rates (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    bond_code TEXT NOT NULL,
    rate REAL NOT NULL,
    effective_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS process_results (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    collateral_id TEXT NOT NULL REFERENCES collaterals(id),
    trade_id TEXT NOT NULL REFERENCES trades(id),
    bond_code TEXT NOT NULL,
    discount_rate REAL NOT NULL,
    discount_amount REAL NOT NULL,
    conclusion TEXT NOT NULL DEFAULT '通过',
    warnings TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS review_records (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches(id),
    result_id TEXT NOT NULL REFERENCES process_results(id),
    status TEXT NOT NULL DEFAULT '待复核',
    reviewer TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT,
    remark TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_trades_batch ON trades(batch_id);
  CREATE INDEX IF NOT EXISTS idx_collaterals_batch ON collaterals(batch_id);
  CREATE INDEX IF NOT EXISTS idx_collaterals_trade ON collaterals(trade_id);
  CREATE INDEX IF NOT EXISTS idx_collaterals_bond ON collaterals(bond_code);
  CREATE INDEX IF NOT EXISTS idx_rates_batch ON discount_rates(batch_id);
  CREATE INDEX IF NOT EXISTS idx_rates_bond ON discount_rates(bond_code);
  CREATE INDEX IF NOT EXISTS idx_results_batch ON process_results(batch_id);
  CREATE INDEX IF NOT EXISTS idx_results_conclusion ON process_results(conclusion);
  CREATE INDEX IF NOT EXISTS idx_reviews_batch ON review_records(batch_id);
  CREATE INDEX IF NOT EXISTS idx_reviews_status ON review_records(status);
`)

export default db
