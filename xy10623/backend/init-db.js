const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'cleaning.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    date DATE NOT NULL,
    event_type TEXT NOT NULL,
    guest_name TEXT,
    check_in TIME,
    check_out TIME,
    status TEXT DEFAULT 'confirmed',
    old_values TEXT,
    new_values TEXT,
    modified_by TEXT,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checkout_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    calendar_event_id INTEGER,
    checkout_date DATE NOT NULL,
    guest_name TEXT,
    actual_checkout_time TIME,
    room_condition TEXT,
    damage_notes TEXT,
    status TEXT DEFAULT 'pending',
    old_values TEXT,
    new_values TEXT,
    modified_by TEXT,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (calendar_event_id) REFERENCES calendar_events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cleaning_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    checkout_event_id INTEGER,
    cleaner_id INTEGER NOT NULL,
    cleaner_name TEXT NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    actual_start_time TIME,
    actual_end_time TIME,
    status TEXT DEFAULT 'assigned',
    quality_score INTEGER,
    inspection_notes TEXT,
    old_values TEXT,
    new_values TEXT,
    modified_by TEXT,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id),
    FOREIGN KEY (checkout_event_id) REFERENCES checkout_events(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rework_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cleaning_assignment_id INTEGER NOT NULL,
    complaint_source TEXT NOT NULL,
    complaint_date DATE NOT NULL,
    complaint_type TEXT NOT NULL,
    description TEXT NOT NULL,
    photos TEXT,
    responsible_person TEXT,
    rework_assign_to TEXT,
    rework_scheduled_date DATE,
    rework_status TEXT DEFAULT 'pending',
    rework_completion_date DATE,
    resolution_notes TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cleaning_assignment_id) REFERENCES cleaning_assignments(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    threshold INTEGER DEFAULT 10,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS material_consumption (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cleaning_assignment_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    expected_quantity INTEGER,
    status TEXT DEFAULT 'normal',
    anomaly_notes TEXT,
    recorded_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cleaning_assignment_id) REFERENCES cleaning_assignments(id),
    FOREIGN KEY (material_id) REFERENCES materials(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cleaners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT DEFAULT 'active',
    total_assignments INTEGER DEFAULT 0,
    total_reworks INTEGER DEFAULT 0,
    avg_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS performance_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cleaner_id INTEGER NOT NULL,
    month DATE NOT NULL,
    total_assignments INTEGER DEFAULT 0,
    completed_on_time INTEGER DEFAULT 0,
    quality_scores TEXT,
    avg_score REAL DEFAULT 0,
    rework_count INTEGER DEFAULT 0,
    manual_adjustment INTEGER DEFAULT 0,
    adjustment_reason TEXT,
    adjusted_by TEXT,
    final_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cleaner_id) REFERENCES cleaners(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    modified_by TEXT,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成！');
});

db.close();
