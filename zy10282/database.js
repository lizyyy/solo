const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./after-sales.db');

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS installation_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      product_name TEXT NOT NULL,
      installer_name TEXT NOT NULL,
      install_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_visit',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      satisfaction INTEGER,
      feedback TEXT,
      issues TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES installation_orders(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sender TEXT,
      send_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES installation_orders(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS reworks (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      reworker_name TEXT NOT NULL,
      rework_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      satisfaction_after INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES installation_orders(id)
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      base_amount REAL NOT NULL,
      deduction REAL NOT NULL DEFAULT 0,
      bonus REAL NOT NULL DEFAULT 0,
      final_amount REAL NOT NULL,
      settled_by TEXT NOT NULL,
      settle_date TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES installation_orders(id)
    )
  `);
});

module.exports = db;
