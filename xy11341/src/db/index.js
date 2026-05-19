const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'warehouse.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS receive_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      engineer_id TEXT NOT NULL,
      engineer_name TEXT NOT NULL,
      engineer_phone TEXT NOT NULL,
      part_code TEXT NOT NULL,
      part_name TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      receive_date TEXT NOT NULL,
      old_part_expected_return_date TEXT,
      old_part_returned INTEGER DEFAULT 0,
      old_part_return_date TEXT,
      claim_status TEXT DEFAULT 'pending',
      claim_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS old_part_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      receive_order_id INTEGER NOT NULL,
      receive_order_no TEXT NOT NULL,
      engineer_id TEXT NOT NULL,
      part_code TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      return_date TEXT NOT NULL,
      return_status TEXT DEFAULT 'completed',
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (receive_order_id) REFERENCES receive_orders(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_no TEXT UNIQUE NOT NULL,
      vendor_code TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      claim_date TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'submitted',
      remarks TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS claim_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_id INTEGER NOT NULL,
      receive_order_id INTEGER NOT NULL,
      part_code TEXT NOT NULL,
      part_name TEXT NOT NULL,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (claim_id) REFERENCES claims(id),
      FOREIGN KEY (receive_order_id) REFERENCES receive_orders(id)
    );

    CREATE TABLE IF NOT EXISTS rule_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      passed INTEGER NOT NULL,
      reason TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_id INTEGER,
      data_no TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      entity_no TEXT,
      before_data TEXT,
      after_data TEXT,
      operator TEXT DEFAULT 'system',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_receive_orders_order_no ON receive_orders(order_no);
    CREATE INDEX IF NOT EXISTS idx_receive_orders_engineer_id ON receive_orders(engineer_id);
    CREATE INDEX IF NOT EXISTS idx_receive_orders_batch_no ON receive_orders(batch_no);
    CREATE INDEX IF NOT EXISTS idx_old_part_returns_receive_order_id ON old_part_returns(receive_order_id);
    CREATE INDEX IF NOT EXISTS idx_rule_results_data_no ON rule_results(data_no);
  `);
}

initTables();

module.exports = db;
