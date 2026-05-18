const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'rebate.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS rebate_orders (
      id TEXT PRIMARY KEY,
      dealer_code TEXT NOT NULL,
      dealer_name TEXT NOT NULL,
      order_no TEXT NOT NULL UNIQUE,
      order_date TEXT NOT NULL,
      settlement_period TEXT NOT NULL,
      rebate_base_amount REAL NOT NULL DEFAULT 0,
      return_amount REAL NOT NULL DEFAULT 0,
      actual_rebate_base REAL NOT NULL DEFAULT 0,
      rebate_rate REAL NOT NULL DEFAULT 0,
      rebate_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      handler TEXT,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rebate_details (
      id TEXT PRIMARY KEY,
      rebate_order_id TEXT NOT NULL,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      sales_amount REAL NOT NULL,
      rebate_rate REAL NOT NULL,
      rebate_amount REAL NOT NULL,
      return_quantity REAL DEFAULT 0,
      return_amount REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (rebate_order_id) REFERENCES rebate_orders(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS modification_history (
      id TEXT PRIMARY KEY,
      rebate_order_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      operator TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      remark TEXT,
      change_content TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (rebate_order_id) REFERENCES rebate_orders(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS return_adjustments (
      id TEXT PRIMARY KEY,
      rebate_order_id TEXT NOT NULL,
      return_order_no TEXT NOT NULL,
      return_date TEXT NOT NULL,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      return_quantity REAL NOT NULL,
      return_amount REAL NOT NULL,
      base_adjustment REAL NOT NULL,
      rebate_adjustment REAL NOT NULL,
      is_post_payment BOOLEAN NOT NULL DEFAULT 0,
      correction_record TEXT,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (rebate_order_id) REFERENCES rebate_orders(id) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_rebate_orders_dealer ON rebate_orders(dealer_code)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rebate_orders_status ON rebate_orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rebate_details_order ON rebate_details(rebate_order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_order ON modification_history(rebate_order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_adjustments_order ON return_adjustments(rebate_order_id)`);
});

module.exports = db;
