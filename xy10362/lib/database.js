const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'invoice.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_tax_id TEXT,
      customer_bank_info TEXT,
      contract_amount REAL NOT NULL,
      contract_date TEXT,
      project_name TEXT,
      effective_date TEXT,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      receipt_date TEXT NOT NULL,
      bank_name TEXT,
      bank_account TEXT,
      payment_method TEXT,
      purpose TEXT,
      is_negative INTEGER DEFAULT 0,
      matched_contract_id INTEGER,
      status TEXT DEFAULT 'pending',
      import_batch TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matched_contract_id) REFERENCES contracts(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      invoice_type TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_tax_id TEXT,
      amount REAL NOT NULL,
      tax_amount REAL,
      total_amount REAL NOT NULL,
      matched_contract_id INTEGER,
      matched_receipt_id INTEGER,
      status TEXT DEFAULT 'valid',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matched_contract_id) REFERENCES contracts(id),
      FOREIGN KEY (matched_receipt_id) REFERENCES receipts(id)
    );

    CREATE TABLE IF NOT EXISTS collection_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id INTEGER NOT NULL,
      follow_up_date TEXT NOT NULL,
      is_followed_up INTEGER DEFAULT 0,
      promise_date TEXT,
      follow_up_remark TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_customer ON contracts(customer_name);
    CREATE INDEX IF NOT EXISTS idx_contracts_no ON contracts(contract_no);
    CREATE INDEX IF NOT EXISTS idx_receipts_customer ON receipts(customer_name);
    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(receipt_date);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_name);
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_collection_contract ON collection_records(contract_id);
  `);
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };
