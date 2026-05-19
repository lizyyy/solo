const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/ship_berth.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      material_hash TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      submitted_by TEXT NOT NULL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      raw_material TEXT NOT NULL,
      error_details TEXT,
      result TEXT,
      exported_at DATETIME,
      exported_by TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      ship_name TEXT NOT NULL,
      imo_no TEXT NOT NULL,
      draught REAL NOT NULL,
      length REAL NOT NULL,
      arrival_time DATETIME NOT NULL,
      estimated_berth_time DATETIME,
      estimated_departure_time DATETIME,
      priority INTEGER DEFAULT 0,
      is_jump_queue BOOLEAN DEFAULT 0,
      jump_queue_approved_by TEXT,
      jump_queue_reason TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS berths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      berth_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      max_draught REAL NOT NULL,
      max_length REAL NOT NULL,
      is_available BOOLEAN DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS berth_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      ship_id INTEGER NOT NULL,
      berth_id INTEGER NOT NULL,
      berth_no TEXT NOT NULL,
      ship_name TEXT NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_by TEXT NOT NULL,
      is_locked BOOLEAN DEFAULT 0,
      locked_at DATETIME,
      locked_by TEXT,
      status TEXT DEFAULT 'assigned',
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (ship_id) REFERENCES ships(id),
      FOREIGN KEY (berth_id) REFERENCES berths(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS berth_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      adjusted_by TEXT NOT NULL,
      adjusted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT NOT NULL,
      before_state TEXT NOT NULL,
      after_state TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES berth_assignments(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATE NOT NULL,
      time DATETIME NOT NULL,
      height REAL NOT NULL,
      tide_type TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      field_name TEXT,
      before_value TEXT,
      after_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS task_status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS field_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      field_path TEXT NOT NULL,
      original_value TEXT NOT NULL,
      final_value TEXT,
      source_position TEXT NOT NULL
    )
  `);

  const stmt = db.prepare('INSERT OR IGNORE INTO berths (berth_no, name, max_draught, max_length) VALUES (?, ?, ?, ?)');
  stmt.run('B001', '1号泊位', 12.5, 300);
  stmt.run('B002', '2号泊位', 10.0, 250);
  stmt.run('B003', '3号泊位', 15.0, 350);
  stmt.run('B004', '4号泊位', 8.0, 200);
  stmt.finalize();

  console.log('数据库初始化完成');
  db.close();
});
