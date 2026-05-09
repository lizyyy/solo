const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'app.db');
const DB_DATA_PATH = path.join(__dirname, 'data', 'app.db.json');

let db = null;
let SQL = null;

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_DATA_PATH, JSON.stringify(Array.from(data)));
}

function loadDatabase() {
  if (fs.existsSync(DB_DATA_PATH)) {
    const dataStr = fs.readFileSync(DB_DATA_PATH, 'utf-8');
    const dataArr = JSON.parse(dataStr);
    const dataBuffer = new Uint8Array(dataArr);
    return new SQL.Database(dataBuffer);
  }
  return null;
}

async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  
  if (db) return db;
  
  db = loadDatabase() || new SQL.Database();
  
  db.run(`
    PRAGMA foreign_keys = ON;
    
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      birth_date TEXT,
      parent_name TEXT,
      parent_phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      total_classes INTEGER NOT NULL,
      used_classes INTEGER DEFAULT 0,
      frozen_classes INTEGER DEFAULT 0,
      purchase_date TEXT DEFAULT (date('now')),
      expire_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      class_date TEXT NOT NULL,
      class_time TEXT,
      status TEXT DEFAULT 'attended',
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      leave_date TEXT NOT NULL,
      reason TEXT,
      classes_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS freezes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      reason TEXT,
      classes_frozen INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (package_id) REFERENCES packages(id),
      FOREIGN KEY (child_id) REFERENCES children(id),
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
    
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );
  `);
  
  saveDatabase();
  return db;
}

function getDatabase() {
  return db;
}

module.exports = { initDatabase, getDatabase, saveDatabase, DB_PATH, DB_DATA_PATH };
