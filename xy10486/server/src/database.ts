import * as sqlite3 from 'sqlite3';
import * as path from 'path';

const dbPath = path.join(__dirname, '../data/fresh-produce.db');
export const db = new sqlite3.Database(dbPath);

export const initDatabase = () => {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      avg_demand REAL DEFAULT 0,
      safety_stock REAL DEFAULT 0,
      min_order REAL DEFAULT 0,
      lead_days INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      weather_tag TEXT,
      is_holiday INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS stock_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      closing_stock REAL NOT NULL,
      wastage REAL DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      order_date TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      suggested_qty REAL NOT NULL,
      adjusted_qty REAL NOT NULL,
      adjustment_reason TEXT,
      actual_qty REAL,
      wastage_qty REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS weather_tags (
      date TEXT PRIMARY KEY,
      tag TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS holidays (
      date TEXT PRIMARY KEY,
      name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS adjustment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      suggested_qty REAL NOT NULL,
      adjusted_qty REAL NOT NULL,
      adjustment_reason TEXT,
      adjustment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      product_id INTEGER,
      order_id INTEGER,
      message TEXT NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      resolved INTEGER DEFAULT 0,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    )`);
  });
};
