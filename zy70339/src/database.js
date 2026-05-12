const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'changes.db');

let db = null;
let SQL = null;

async function initDb() {
  if (db) return db;
  
  SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS freeze_windows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      scope TEXT NOT NULL CHECK(scope IN ('global', 'service')),
      affected_services TEXT,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')),
      allow_readonly INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS change_requests (
      id TEXT PRIMARY KEY,
      change_id TEXT NOT NULL UNIQUE,
      service TEXT NOT NULL,
      change_type TEXT NOT NULL CHECK(change_type IN ('normal', 'readonly', 'emergency')),
      risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'medium', 'high')),
      planned_start TEXT NOT NULL,
      planned_end TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'exception_requested', 'exception_approved', 'exception_rejected')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      change_request_id TEXT NOT NULL,
      approver TEXT NOT NULL,
      decision TEXT NOT NULL CHECK(decision IN ('approved', 'rejected')),
      reason TEXT,
      valid_from TEXT,
      valid_until TEXT,
      applicable_services TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function prepare(sql) {
  return {
    run: function(...params) {
      db.run(sql, params);
      saveDb();
    },
    get: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: function(...params) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    }
  };
}

module.exports = {
  initDb,
  prepare
};
