const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, '../data/makeup-allergy.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS consultants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      consultant_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shift TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (consultant_id) REFERENCES consultants(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT,
      ingredients TEXT,
      stock INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      allergy_history TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS allergy_records (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      allergen TEXT NOT NULL,
      severity TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS makeup_sessions (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE,
      customer_id TEXT NOT NULL,
      consultant_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      risk_level TEXT,
      allergy_check_result TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (consultant_id) REFERENCES consultants(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      review_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES makeup_sessions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS follow_ups (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      date TEXT NOT NULL,
      result TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES makeup_sessions(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      status TEXT NOT NULL,
      details TEXT,
      failure_reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    console.log('数据表初始化完成');
  });
}

module.exports = db;
