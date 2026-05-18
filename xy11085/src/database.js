const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/quotes.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS quote_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_no TEXT NOT NULL UNIQUE,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      paper_type TEXT NOT NULL,
      paper_size TEXT NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      quantity INTEGER NOT NULL,
      color_mode TEXT NOT NULL,
      double_sided INTEGER NOT NULL DEFAULT 0,
      locked_price REAL NOT NULL,
      original_price REAL NOT NULL,
      discount_rate REAL,
      status TEXT NOT NULL DEFAULT 'pending',
      responsible_person TEXT NOT NULL,
      lock_date TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_to TEXT NOT NULL,
      batch_no TEXT,
      review_conclusion TEXT,
      review_by TEXT,
      review_time TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS quote_lock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_lock_id INTEGER NOT NULL,
      quote_no TEXT NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quote_lock_id) REFERENCES quote_locks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT NOT NULL UNIQUE,
      total_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      imported_by TEXT NOT NULL,
      imported_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_quote_no ON quote_locks(quote_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON quote_locks(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_store ON quote_locks(store_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_responsible ON quote_locks(responsible_person)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lock_date ON quote_locks(lock_date)`);
});

module.exports = db;
