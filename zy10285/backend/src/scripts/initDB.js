const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'ice-delivery.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    address TEXT,
    balance REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ice_specs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    weight REAL NOT NULL,
    price REAL NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS delivery_slots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    max_capacity REAL NOT NULL,
    current_load REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(date, start_time, end_time)
  );

  CREATE TABLE IF NOT EXISTS coolers (
    id TEXT PRIMARY KEY,
    serial_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'available',
    customer_id TEXT,
    assigned_at TEXT,
    last_returned_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_no TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    ice_spec_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    delivery_slot_id TEXT NOT NULL,
    cooler_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    delivery_address TEXT,
    contact_phone TEXT,
    signed_at TEXT,
    signed_by TEXT,
    refund_reason TEXT,
    refund_at TEXT,
    notes TEXT,
    import_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (ice_spec_id) REFERENCES ice_specs(id),
    FOREIGN KEY (delivery_slot_id) REFERENCES delivery_slots(id),
    FOREIGN KEY (cooler_id) REFERENCES coolers(id)
  );

  CREATE TABLE IF NOT EXISTS order_history (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    operator TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_slot ON orders(delivery_slot_id);
  CREATE INDEX IF NOT EXISTS idx_orders_import_hash ON orders(import_hash);
`);

console.log('数据库初始化完成！');
db.close();
