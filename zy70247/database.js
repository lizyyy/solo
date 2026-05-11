const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'lab.db');

if (!fs.existsSync(path.dirname(dbPath))) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('物理', '化学', '生物')),
      type TEXT NOT NULL CHECK(type IN ('普通', '危险')),
      is_consumable BOOLEAN NOT NULL,
      quantity INTEGER NOT NULL,
      unit TEXT NOT NULL,
      location TEXT,
      description TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reservation_date TEXT NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL CHECK(status IN ('待审批', '已确认', '已拒绝', '已完成')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      approved_by TEXT,
      approval_time TEXT,
      approval_comment TEXT,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS consumable_deductions (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      deduction_time TEXT NOT NULL,
      operator TEXT,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id),
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS data_runs (
      id TEXT PRIMARY KEY,
      run_name TEXT NOT NULL,
      executed_at TEXT NOT NULL
    )
  `);
});

module.exports = db;
