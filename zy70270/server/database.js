const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data.sqlite');

let db = null;

async function getDB() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  device_code TEXT NOT NULL UNIQUE,
  model TEXT,
  location TEXT,
  status TEXT DEFAULT 'normal',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS consumables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  current_level REAL DEFAULT 100,
  min_threshold REAL DEFAULT 10,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS faults (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id INTEGER NOT NULL,
  fault_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS supply_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id INTEGER NOT NULL,
  device_id INTEGER,
  type TEXT NOT NULL,
  item TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  notes TEXT
)`);
  
  saveDB();
  return db;
}

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function prepare(sql) {
  return {
    run(...params) {
      try {
        db.run(sql, params);
        saveDB();
        const result = db.exec('SELECT last_insert_rowid() as id');
        const lastId = result && result[0] && result[0].values && result[0].values[0] ? result[0].values[0][0] : null;
        return { lastInsertRowid: lastId, changes: 1 };
      } catch (e) {
        throw e;
      }
    },
    get(...params) {
      try {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const result = stmt.getAsObject();
          stmt.free();
          return result;
        }
        stmt.free();
        return undefined;
      } catch (e) {
        throw e;
      }
    },
    all(...params) {
      try {
        const results = [];
        const stmt = db.prepare(sql);
        stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } catch (e) {
        throw e;
      }
    }
  };
}

function exec(sql) {
  db.run(sql);
  saveDB();
}

module.exports = { getDB, prepare, exec, saveDB };
