const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'meeting_room.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS meeting_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    location TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS projection_devices (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    status TEXT DEFAULT 'normal',
    last_maintenance TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT,
    user_name TEXT NOT NULL,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    attendees INTEGER,
    needs_projector INTEGER DEFAULT 0,
    tea_service_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES meeting_rooms(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tea_services (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    handler TEXT,
    handled_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS fault_tickets (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    reporter TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    handler TEXT,
    handled_at TEXT,
    resolution TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES projection_devices(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cancellations (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    cancelled_by TEXT NOT NULL,
    cancelled_at TEXT DEFAULT CURRENT_TIMESTAMP,
    released_hours REAL NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS modification_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    modified_by TEXT NOT NULL,
    modified_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS anomalies (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    description TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    handler TEXT,
    handled_at TEXT,
    correction_before TEXT,
    correction_after TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('数据库表创建完成');

  const initData = require('./initData');
  initData(db);
});

db.close();
