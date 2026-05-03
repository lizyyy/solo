const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const dbPath = path.join(__dirname, '..', 'data', 'cylinders.db');
const db = new sqlite3.Database(dbPath);

const routes = require('./routes');
app.use('/api', routes(db));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS cylinders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    gas_type TEXT NOT NULL,
    capacity REAL,
    manufacturer TEXT,
    manufacture_date TEXT,
    last_inspection_date TEXT,
    next_inspection_date TEXT,
    status TEXT DEFAULT 'in_stock',
    location TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cylinder_id INTEGER NOT NULL,
    inspection_date TEXT NOT NULL,
    inspector TEXT,
    result TEXT NOT NULL,
    notes TEXT,
    next_inspection_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cylinder_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    department TEXT,
    person TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_number TEXT UNIQUE NOT NULL,
    from_location TEXT NOT NULL,
    to_location TEXT NOT NULL,
    transfer_date TEXT NOT NULL,
    sender TEXT,
    receiver TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS transfer_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transfer_id INTEGER NOT NULL,
    cylinder_id INTEGER NOT NULL,
    serial_number TEXT NOT NULL,
    gas_type TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_id) REFERENCES transfers(id),
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS risk_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cylinder_id INTEGER,
    risk_type TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    reviewed_by TEXT,
    reviewed_at TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation TEXT NOT NULL,
    table_name TEXT,
    record_id INTEGER,
    old_values TEXT,
    new_values TEXT,
    user TEXT,
    ip_address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

app.listen(PORT, () => {
  console.log(`医用气瓶周转防错台 API 服务运行在 http://localhost:${PORT}`);
  console.log(`数据库路径: ${dbPath}`);
});
