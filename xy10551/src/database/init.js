const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'community.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  let dbBuffer = null;
  if (fs.existsSync(dbPath)) {
    try {
      dbBuffer = fs.readFileSync(dbPath);
    } catch (e) {
      console.warn('读取数据库文件失败，创建新数据库:', e.message);
    }
  }
  
  db = new SQL.Database(dbBuffer);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS residents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      id_card TEXT UNIQUE,
      birth_date TEXT NOT NULL,
      gender TEXT,
      phone TEXT,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      resident_id TEXT NOT NULL,
      name TEXT NOT NULL,
      relation TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT,
      location TEXT,
      max_participants INTEGER NOT NULL,
      min_age INTEGER,
      max_age INTEGER,
      max_per_family INTEGER,
      status TEXT DEFAULT 'draft',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      resident_id TEXT NOT NULL,
      family_member_ids TEXT,
      participant_count INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      check_in_time TEXT,
      check_in_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (activity_id) REFERENCES activities(id),
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    );

    CREATE TABLE IF NOT EXISTS waitlist (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      resident_id TEXT NOT NULL,
      family_member_ids TEXT,
      participant_count INTEGER NOT NULL,
      position INTEGER NOT NULL,
      status TEXT DEFAULT 'waiting',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (activity_id) REFERENCES activities(id),
      FOREIGN KEY (resident_id) REFERENCES residents(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_data TEXT,
      after_data TEXT,
      operator TEXT,
      reason TEXT,
      request_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      request_id TEXT UNIQUE NOT NULL,
      action TEXT NOT NULL,
      response_data TEXT,
      status_code INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  saveDatabase();
  return db;
}

function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.error('保存数据库失败:', e.message);
  }
}

function prepare(sql) {
  return {
    run: function(...params) {
      try {
        db.run(sql, params);
        saveDatabase();
        return { changes: db.getRowsModified() };
      } catch (e) {
        throw e;
      }
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return null;
    },
    all: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    }
  };
}

function exec(sql) {
  try {
    db.run(sql);
    saveDatabase();
  } catch (e) {
    console.error('执行 SQL 失败:', e.message, sql);
    throw e;
  }
}

function pragma(sql) {
  return [];
}

const dbWrapper = {
  prepare,
  exec,
  pragma,
  saveDatabase
};

module.exports = dbWrapper;
module.exports.init = initDatabase;
