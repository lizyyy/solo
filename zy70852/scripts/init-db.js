const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/lost_found.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('开始初始化数据库...');

  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    batch_type TEXT NOT NULL,
    source_file TEXT,
    total_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remark TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS route_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_no TEXT NOT NULL,
    shift_no TEXT NOT NULL,
    driver_name TEXT,
    driver_phone TEXT,
    vehicle_no TEXT,
    departure_time DATETIME,
    arrival_time DATETIME,
    start_station TEXT,
    end_station TEXT,
    batch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    UNIQUE(route_no, shift_no, departure_time)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS lost_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_no TEXT UNIQUE NOT NULL,
    item_name TEXT NOT NULL,
    item_description TEXT,
    item_category TEXT,
    found_time DATETIME NOT NULL,
    found_location TEXT,
    route_no TEXT,
    shift_no TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    finder_name TEXT,
    finder_phone TEXT,
    image_ids TEXT,
    batch_id INTEGER,
    status TEXT DEFAULT 'pending',
    pickup_voucher_no TEXT,
    pickup_time DATETIME,
    receiver_name TEXT,
    receiver_phone TEXT,
    receiver_id_card TEXT,
    is_overdue INTEGER DEFAULT 0,
    overdue_days INTEGER DEFAULT 0,
    has_same_name INTEGER DEFAULT 0,
    sensitive_info_masked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES batches(id),
    FOREIGN KEY (pickup_voucher_no) REFERENCES pickup_vouchers(voucher_no)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS processing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    action_reason TEXT,
    operator TEXT NOT NULL,
    operator_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    old_status TEXT,
    new_status TEXT,
    remark TEXT,
    FOREIGN KEY (item_id) REFERENCES lost_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pickup_vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_no TEXT UNIQUE NOT NULL,
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    issuer TEXT NOT NULL,
    issue_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    expire_time DATETIME,
    status TEXT DEFAULT 'valid',
    used_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES lost_items(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS image_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_code TEXT UNIQUE NOT NULL,
    file_path TEXT NOT NULL,
    item_id INTEGER,
    upload_batch_no TEXT,
    uploaded_by TEXT,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES lost_items(id)
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lost_items_route ON lost_items(route_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lost_items_driver ON lost_items(driver_name)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lost_items_voucher ON lost_items(pickup_voucher_no)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_item ON processing_history(item_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_route_schedule ON route_schedules(route_no, shift_no)`);

  console.log('数据库初始化完成！');
});

db.close();
