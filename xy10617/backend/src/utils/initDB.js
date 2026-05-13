const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/consignment.db');
const dbDir = path.dirname(dbPath);

require('fs').mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  db.run(`
    CREATE TABLE IF NOT EXISTS consignors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      id_card TEXT,
      bank_account TEXT,
      bank_name TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      consignor_id TEXT NOT NULL,
      isbn TEXT,
      title TEXT NOT NULL,
      author TEXT,
      publisher TEXT,
      original_price REAL,
      estimated_price REAL,
      current_price REAL,
      status TEXT DEFAULT 'pending_evaluation',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consignor_id) REFERENCES consignors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      evaluator TEXT NOT NULL,
      condition TEXT NOT NULL,
      condition_description TEXT,
      estimated_price REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS price_reductions (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      original_price REAL NOT NULL,
      proposed_price REAL NOT NULL,
      reason TEXT,
      proposer TEXT NOT NULL,
      approver TEXT,
      status TEXT DEFAULT 'pending',
      approved_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      sold_price REAL NOT NULL,
      sold_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sold_by TEXT NOT NULL,
      platform TEXT,
      buyer_info TEXT,
      commission_rate REAL DEFAULT 0.3,
      seller_share REAL,
      platform_fee REAL,
      status TEXT DEFAULT 'completed',
      exception_type TEXT,
      exception_note TEXT,
      handled_by TEXT,
      handled_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      return_reason TEXT,
      returned_at TEXT,
      received_by TEXT,
      inspection_result TEXT,
      inspection_notes TEXT,
      inspected_by TEXT,
      inspected_at TEXT,
      status TEXT DEFAULT 'pending_inspection',
      manual_process_required INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      consignor_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      total_sales REAL DEFAULT 0,
      total_commission REAL DEFAULT 0,
      total_settlement REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      generated_by TEXT,
      generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      paid_at TEXT,
      paid_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consignor_id) REFERENCES consignors(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settlement_items (
      id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      sale_id TEXT,
      sold_price REAL,
      commission REAL,
      seller_share REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (settlement_id) REFERENCES settlements(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_timeline (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      status TEXT NOT NULL,
      previous_status TEXT,
      changed_by TEXT NOT NULL,
      change_reason TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      resource_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库初始化完成');
});

db.close();
