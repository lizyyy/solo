const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'replay.db');
let SQL = null;
let db = null;
let _ready = null;
let _lastInsertRowid = 0;
let _changes = 0;

function ready() {
  if (_ready) return _ready;
  _ready = (async () => {
    SQL = await initSqlJs({
      locateFile: file => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    });
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const buf = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
    db = buf ? new SQL.Database(buf) : new SQL.Database();
    return db;
  })();
  return _ready;
}

function persist() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) {
    console.error('[db] 持久化失败:', e.message);
  }
}

function resetDB() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  db = new SQL.Database();
  persist();
  return db;
}

function getDB() {
  if (!db) throw new Error('数据库未就绪,请先 await ready()');
  return db;
}

function runSQL(sql, params = []) {
  if (!db) throw new Error('数据库未就绪');
  _changes = 0;
  _lastInsertRowid = 0;
  db.run(sql, params);
  const res = db.exec('SELECT last_insert_rowid() AS li, changes() AS ch')[0];
  if (res && res.values && res.values.length) {
    _lastInsertRowid = res.values[0][0];
    _changes = res.values[0][1];
  }
  persist();
  return { lastInsertRowid: _lastInsertRowid, changes: _changes };
}

function getSQL(sql, params = []) {
  if (!db) throw new Error('数据库未就绪');
  const results = db.exec(sql, params);
  if (!results.length) return undefined;
  const r = results[0];
  if (!r.values.length) return undefined;
  const row = {};
  r.columns.forEach((c, i) => row[c] = r.values[0][i]);
  return row;
}

function allSQL(sql, params = []) {
  if (!db) throw new Error('数据库未就绪');
  const results = db.exec(sql, params);
  if (!results.length) return [];
  const r = results[0];
  return r.values.map(row => {
    const obj = {};
    r.columns.forEach((c, i) => obj[c] = row[i]);
    return obj;
  });
}

/* better-sqlite3 兼容层: prepare().run().get().all().transaction() */
function prepare(sql) {
  let boundParams = [];
  const self = {
    bind(...args) {
      boundParams = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
      return self;
    },
    run(...args) {
      const p = args.length ? (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) : boundParams;
      return runSQL(sql, p);
    },
    get(...args) {
      const p = args.length ? (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) : boundParams;
      return getSQL(sql, p);
    },
    all(...args) {
      const p = args.length ? (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) : boundParams;
      return allSQL(sql, p);
    }
  };
  return self;
}

function exec(sql) {
  if (!db) throw new Error('数据库未就绪');
  db.exec(sql);
  persist();
  return null;
}

function pragma(expr) {
  if (!db) throw new Error('数据库未就绪');
  try { db.exec('PRAGMA ' + expr); } catch (e) { /* sql.js 部分 pragma 不支持,忽略 */ }
  return [];
}

function transaction(fn) {
  return function wrapped(...args) {
    if (!db) throw new Error('数据库未就绪');
    db.exec('BEGIN');
    try {
      const r = fn.apply(this, args);
      db.exec('COMMIT');
      persist();
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
}

/* 覆盖 db 对象上的 prepare/exec/pragma/transaction，使 getDB() 返回的对象支持这些方法 */
function wrapDB() {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === 'prepare') return prepare;
      if (prop === 'exec') return exec;
      if (prop === 'pragma') return pragma;
      if (prop === 'transaction') return transaction;
      if (prop === '_raw') return db;
      return undefined;
    }
  });
}

function getDBWrapped() {
  if (!db) throw new Error('数据库未就绪,请先 await ready()');
  return wrapDB();
}

function initDB() {
  if (!db) throw new Error('数据库未就绪');
  pragma('journal_mode = WAL');
  pragma('foreign_keys = ON');
  exec(`
    CREATE TABLE IF NOT EXISTS workorders (
      id TEXT PRIMARY KEY,
      blade_no TEXT NOT NULL,
      wind_farm TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      confirm_note TEXT,
      return_reason TEXT,
      source_import_id TEXT,
      created_step_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sensor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workorder_id TEXT NOT NULL,
      log_time TEXT NOT NULL,
      vibration REAL NOT NULL,
      pitch REAL NOT NULL,
      temp REAL NOT NULL,
      is_boundary INTEGER DEFAULT 0,
      raw_line_no INTEGER,
      source_file TEXT,
      remark TEXT,
      FOREIGN KEY (workorder_id) REFERENCES workorders(id)
    );

    CREATE TABLE IF NOT EXISTS spare_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workorder_id TEXT NOT NULL,
      original_model TEXT NOT NULL,
      replacement_model TEXT,
      quantity INTEGER NOT NULL,
      replaced_at TEXT,
      replace_source_line TEXT,
      replace_impact_scope TEXT,
      replace_operator TEXT,
      status TEXT DEFAULT 'original',
      FOREIGN KEY (workorder_id) REFERENCES workorders(id)
    );

    CREATE TABLE IF NOT EXISTS replay_steps (
      id TEXT PRIMARY KEY,
      seq_no INTEGER NOT NULL,
      action TEXT NOT NULL,
      operator TEXT NOT NULL,
      params_before TEXT,
      params_after TEXT,
      changed_fields TEXT,
      workorder_impact TEXT,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS replay_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step_id TEXT NOT NULL,
      workorder_id TEXT NOT NULL,
      status_snapshot TEXT NOT NULL,
      anomaly_flags TEXT,
      parts_summary TEXT,
      sensor_stats TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (step_id) REFERENCES replay_steps(id),
      FOREIGN KEY (workorder_id) REFERENCES workorders(id)
    );

    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      operator TEXT NOT NULL,
      step_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_wo ON sensor_logs(workorder_id);
    CREATE INDEX IF NOT EXISTS idx_parts_wo ON spare_parts(workorder_id);
    CREATE INDEX IF NOT EXISTS idx_steps_seq ON replay_steps(seq_no);
    CREATE INDEX IF NOT EXISTS idx_snapshot_step ON replay_snapshots(step_id);
  `);
  return wrapDB();
}

module.exports = {
  DB_PATH,
  ready,
  resetDB,
  persist,
  getDB: getDBWrapped,
  initDB
};
