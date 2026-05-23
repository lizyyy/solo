const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_no TEXT NOT NULL UNIQUE,
    building_name TEXT,
    total_floors INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER NOT NULL,
    room_no TEXT NOT NULL,
    owner_name TEXT,
    owner_phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (building_id) REFERENCES buildings(id),
    UNIQUE(building_id, room_no)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS handlers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    department TEXT,
    is_outsource BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS repair_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE NOT NULL,
    room_id INTEGER NOT NULL,
    repair_type TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'pending',
    handler_id INTEGER,
    reported_by TEXT,
    reported_phone TEXT,
    reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expected_completion_at DATETIME,
    completed_at DATETIME,
    is_timeout BOOLEAN DEFAULT 0,
    is_merged BOOLEAN DEFAULT 0,
    merged_from INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (handler_id) REFERENCES handlers(id),
    FOREIGN KEY (merged_from) REFERENCES repair_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reminder_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_order_id INTEGER NOT NULL,
    reminder_type TEXT NOT NULL,
    reminder_content TEXT,
    reminded_by TEXT,
    reminded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_duplicate BOOLEAN DEFAULT 0,
    merged_to INTEGER,
    FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (merged_to) REFERENCES repair_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS outsource_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_order_id INTEGER NOT NULL,
    outsource_company TEXT NOT NULL,
    outsource_contact TEXT,
    outsource_phone TEXT,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    promised_completion_at DATETIME,
    actual_completion_at DATETIME,
    status TEXT DEFAULT 'assigned',
    cost DECIMAL(10, 2),
    FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS completion_proofs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_order_id INTEGER NOT NULL,
    proof_type TEXT NOT NULL,
    proof_content TEXT,
    verified_by INTEGER,
    verified_at DATETIME,
    is_verified BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (verified_by) REFERENCES handlers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repair_order_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER,
    change_reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (changed_by) REFERENCES handlers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS exception_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_input TEXT NOT NULL,
    exception_type TEXT NOT NULL,
    handling_result TEXT NOT NULL,
    repair_order_id INTEGER,
    handled_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_order_id) REFERENCES repair_orders(id),
    FOREIGN KEY (handled_by) REFERENCES handlers(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON repair_orders(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_repair_orders_timeout ON repair_orders(is_timeout)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reminder_records_duplicate ON reminder_records(is_duplicate)`);

  console.log('数据库表创建完成');
});

db.close();
