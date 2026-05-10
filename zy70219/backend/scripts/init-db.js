const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'kitchen.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS kitchens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT,
    capacity INTEGER DEFAULT 3,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kitchen_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_id) REFERENCES kitchens(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kitchen_id INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_id) REFERENCES kitchens(id),
    FOREIGN KEY (team_id) REFERENCES teams(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS equipment_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    reservation_id INTEGER,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipments(id),
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cleaning_windows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kitchen_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    operator TEXT,
    status TEXT DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_id) REFERENCES kitchens(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fire_inspections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kitchen_id INTEGER NOT NULL,
    scheduled_time DATETIME NOT NULL,
    inspector TEXT,
    status TEXT DEFAULT 'scheduled',
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (kitchen_id) REFERENCES kitchens(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_id INTEGER NOT NULL,
    approver TEXT,
    status TEXT DEFAULT 'pending',
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS history_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_reservations_kitchen_time ON reservations(kitchen_id, start_time, end_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_equip_bookings_equip_time ON equipment_bookings(equipment_id, start_time, end_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cleaning_kitchen_time ON cleaning_windows(kitchen_id, start_time, end_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_fire_kitchen_time ON fire_inspections(kitchen_id, scheduled_time)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_history_entity ON history_logs(entity_type, entity_id)`);

  console.log('数据库初始化完成！');
});

db.close();
