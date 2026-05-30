import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/royalty.db');

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS author (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tax_id TEXT,
    bank_account TEXT,
    email TEXT,
    tax_rate REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS book (
    id TEXT PRIMARY KEY,
    isbn TEXT,
    title TEXT NOT NULL,
    author_id TEXT REFERENCES author(id),
    product_type TEXT NOT NULL CHECK (product_type IN ('PHYSICAL', 'EBOOK', 'DISCOUNT')),
    list_price REAL NOT NULL,
    publish_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contract (
    id TEXT PRIMARY KEY,
    author_id TEXT NOT NULL REFERENCES author(id),
    book_id TEXT NOT NULL REFERENCES book(id),
    effective_date TEXT NOT NULL,
    expiry_date TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    special_terms TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS royalty_ladder (
    id TEXT PRIMARY KEY,
    contract_id TEXT NOT NULL REFERENCES contract(id),
    product_type TEXT NOT NULL,
    min_volume INTEGER NOT NULL DEFAULT 0,
    max_volume INTEGER,
    rate REAL NOT NULL,
    ladder_type TEXT NOT NULL DEFAULT 'STANDARD',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_record (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES book(id),
    channel TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_amount REAL NOT NULL,
    discount_activity_id TEXT REFERENCES discount_activity(id),
    is_dirty INTEGER DEFAULT 0,
    raw_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_record (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES book(id),
    original_sale_id TEXT REFERENCES sales_record(id),
    return_date TEXT NOT NULL,
    settlement_period TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    amount REAL NOT NULL,
    reason TEXT,
    is_late INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS discount_activity (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    product_type TEXT,
    adjusted_rate REAL,
    ladder_override TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settlement (
    id TEXT PRIMARY KEY,
    period TEXT NOT NULL,
    author_id TEXT NOT NULL REFERENCES author(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    locked_at TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    total_amount REAL DEFAULT 0,
    created_by TEXT,
    locked_by TEXT,
    calculation_log_id TEXT
);

CREATE TABLE IF NOT EXISTS settlement_item (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES settlement(id),
    book_id TEXT NOT NULL REFERENCES book(id),
    product_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    sales_volume INTEGER NOT NULL DEFAULT 0,
    sales_amount REAL NOT NULL DEFAULT 0,
    return_volume INTEGER NOT NULL DEFAULT 0,
    return_amount REAL NOT NULL DEFAULT 0,
    net_sales_volume INTEGER NOT NULL DEFAULT 0,
    ladder_tier INTEGER,
    ladder_range TEXT,
    royalty_rate REAL NOT NULL DEFAULT 0,
    royalty_amount REAL NOT NULL DEFAULT 0,
    calculation_trail_id TEXT REFERENCES calculation_trail(id)
);

CREATE TABLE IF NOT EXISTS settlement_exception (
    id TEXT PRIMARY KEY,
    settlement_id TEXT NOT NULL REFERENCES settlement(id),
    settlement_item_id TEXT REFERENCES settlement_item(id),
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    raw_data TEXT,
    is_confirmed INTEGER DEFAULT 0,
    confirmed_by TEXT,
    confirmed_at TEXT,
    confirmation_note TEXT,
    auto_overridable INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calculation_trail (
    id TEXT PRIMARY KEY,
    settlement_item_id TEXT NOT NULL REFERENCES settlement_item(id),
    formula TEXT NOT NULL,
    steps TEXT NOT NULL,
    inputs TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    settlement_id TEXT REFERENCES settlement(id),
    action TEXT NOT NULL,
    operator TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    old_value TEXT,
    new_value TEXT,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_book_date ON sales_record(book_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_settlement_author_period ON settlement(author_id, period);
CREATE INDEX IF NOT EXISTS idx_exception_settlement ON settlement_exception(settlement_id);
CREATE INDEX IF NOT EXISTS idx_item_settlement ON settlement_item(settlement_id);
CREATE INDEX IF NOT EXISTS idx_return_book_date ON return_record(book_id, return_date);
CREATE INDEX IF NOT EXISTS idx_ladder_contract ON royalty_ladder(contract_id);
`;

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    dbInstance = new Database(DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
  }
  return dbInstance;
}

export function initDb(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default getDb;
