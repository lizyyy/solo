const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'stone_factory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    order_type TEXT NOT NULL,
    order_date TEXT NOT NULL,
    delivery_date TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS slabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    batch_number TEXT NOT NULL,
    slab_number TEXT NOT NULL,
    color TEXT,
    thickness REAL,
    width REAL,
    height REAL,
    area REAL,
    has_cracks INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cutting_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slab_id INTEGER,
    order_id INTEGER,
    cutting_type TEXT NOT NULL,
    piece_name TEXT,
    length REAL,
    width REAL,
    direction TEXT,
    machine TEXT,
    operator TEXT,
    cutting_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (slab_id) REFERENCES slabs(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS quality_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cutting_log_id INTEGER,
    order_id INTEGER,
    inspection_type TEXT NOT NULL,
    has_chamfer INTEGER DEFAULT 0,
    has_anti_slip_groove INTEGER DEFAULT 0,
    groove_distance REAL,
    groove_count INTEGER,
    has_cracks INTEGER DEFAULT 0,
    dimension_ok INTEGER DEFAULT 1,
    inspector TEXT,
    inspection_date TEXT,
    result TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cutting_log_id) REFERENCES cutting_logs(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS review_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    reviewer TEXT,
    comment TEXT NOT NULL,
    risk_level TEXT DEFAULT 'normal',
    review_date TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS dimension_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    piece_name TEXT NOT NULL,
    spec_length REAL,
    spec_width REAL,
    spec_thickness REAL,
    direction TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_slabs_order ON slabs(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cutting_logs_order ON cutting_logs(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_inspections_order ON quality_inspections(order_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reviews_order ON review_comments(order_id)`);
});

module.exports = db;
