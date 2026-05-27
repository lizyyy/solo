const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'streetlight_repair.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      material_hash TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      submit_time INTEGER NOT NULL,
      last_handler TEXT,
      total_records INTEGER DEFAULT 0,
      valid_records INTEGER DEFAULT 0,
      error_records INTEGER DEFAULT 0,
      raw_material TEXT NOT NULL,
      export_time INTEGER,
      FOREIGN KEY (last_handler) REFERENCES handlers(id)
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      record_no TEXT NOT NULL,
      streetlight_id TEXT NOT NULL,
      alarm_time INTEGER,
      alarm_level TEXT,
      alarm_type TEXT,
      patrol_time INTEGER,
      patrol_person TEXT,
      patrol_issue TEXT,
      repair_time INTEGER,
      repair_person TEXT,
      repair_result TEXT,
      alarm_on_map INTEGER DEFAULT 0,
      patrol_on_map INTEGER DEFAULT 0,
      repair_on_map INTEGER DEFAULT 0,
      is_valid INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      record_index INTEGER NOT NULL,
      error_type TEXT NOT NULL,
      error_field TEXT,
      error_message TEXT NOT NULL,
      raw_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS handlers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_hash ON tasks(material_hash);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_records_task ON records(task_id);
    CREATE INDEX IF NOT EXISTS idx_errors_task ON errors(task_id);
  `);

  const handlerCount = db.prepare('SELECT COUNT(*) as count FROM handlers').get().count;
  if (handlerCount === 0) {
    const insertHandler = db.prepare('INSERT INTO handlers (id, name, department, created_at) VALUES (?, ?, ?, ?)');
    const now = Date.now();
    insertHandler.run('h001', '张工', '市政运维一部', now);
    insertHandler.run('h002', '李工', '市政运维二部', now);
    insertHandler.run('h003', '王工', '市政运维三部', now);
  }
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };