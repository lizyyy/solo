const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'gift_management.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS gift_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_name TEXT NOT NULL,
    gift_type TEXT,
    quantity INTEGER DEFAULT 0,
    unit TEXT,
    unit_price REAL,
    supplier TEXT,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS gift_inventory_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER,
    before_data TEXT,
    after_data TEXT,
    operator TEXT,
    operation_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    gift_type TEXT,
    total_quantity INTEGER,
    budget REAL,
    responsible_person TEXT,
    status TEXT DEFAULT 'draft',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS activity_plans_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    before_data TEXT,
    after_data TEXT,
    operator TEXT,
    operation_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    customer_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    gift_type TEXT,
    gift_quantity INTEGER,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS customer_lists_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    before_data TEXT,
    after_data TEXT,
    operator TEXT,
    operation_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS employee_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    department TEXT,
    gift_type TEXT,
    quantity INTEGER,
    claim_date DATE,
    purpose TEXT,
    approver TEXT,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS express_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    tracking_number TEXT,
    express_company TEXT,
    sender TEXT,
    send_date DATE,
    receive_date DATE,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS return_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gift_type TEXT,
    quantity INTEGER,
    return_reason TEXT,
    return_date DATE,
    handler TEXT,
    source_type TEXT,
    source_id INTEGER,
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exception_type TEXT,
    related_module TEXT,
    related_id INTEGER,
    reason TEXT NOT NULL,
    before_value TEXT,
    after_value TEXT,
    handler TEXT,
    handle_time DATETIME,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
