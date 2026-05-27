const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, '..', 'streetlight_repair.db');

async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();

  let dbData = null;
  if (fs.existsSync(dbPath)) {
    dbData = fs.readFileSync(dbPath);
    db = new SQL.Database(dbData);
  } else {
    db = new SQL.Database();
  }

  db.run(`
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
  `);

  db.run(`
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
  `);

  db.run(`
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
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS handlers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_hash ON tasks(material_hash)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_records_task ON records(task_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_errors_task ON errors(task_id)');

  const handlerCount = db.exec('SELECT COUNT(*) as count FROM handlers')[0].values[0][0];
  if (handlerCount === 0) {
    const now = Date.now();
    db.run('INSERT INTO handlers (id, name, department, created_at) VALUES (?, ?, ?, ?)', ['h001', '张工', '市政运维一部', now]);
    db.run('INSERT INTO handlers (id, name, department, created_at) VALUES (?, ?, ?, ?)', ['h002', '李工', '市政运维二部', now]);
    db.run('INSERT INTO handlers (id, name, department, created_at) VALUES (?, ?, ?, ?)', ['h003', '王工', '市政运维三部', now]);
    saveDatabase();
  }

  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDb() {
  return db;
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDatabase();
      const changes = db.getRowsModified();
      const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
      return { changes, lastInsertRowid: lastId };
    },
    get: function(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0 || results[0].values.length === 0) return undefined;
      const columns = results[0].columns;
      const values = results[0].values[0];
      const row = {};
      columns.forEach((col, i) => row[col] = values[i]);
      return row;
    },
    all: function(...params) {
      const results = db.exec(sql, params);
      if (results.length === 0) return [];
      const columns = results[0].columns;
      return results[0].values.map(values => {
        const row = {};
        columns.forEach((col, i) => row[col] = values[i]);
        return row;
      });
    }
  };
}

function transaction(fn) {
  db.run('BEGIN TRANSACTION');
  try {
    fn();
    db.run('COMMIT');
    saveDatabase();
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

module.exports = { initDatabase, getDb, prepare, transaction, saveDatabase };