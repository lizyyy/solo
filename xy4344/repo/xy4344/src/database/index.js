const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(process.cwd(), '.sl-review');
const DB_PATH = path.join(DB_DIR, 'review.db');

let db = null;

function ensureDBDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function initDB() {
  return new Promise((resolve, reject) => {
    ensureDBDir();
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      createTables().then(resolve).catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS subtitles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          index_num INTEGER,
          start_time INTEGER,
          end_time INTEGER,
          start_time_str TEXT,
          end_time_str TEXT,
          text TEXT,
          duration INTEGER,
          source_file TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS vocabulary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          meaning TEXT,
          category TEXT,
          difficulty TEXT,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          order_num INTEGER,
          start_time TEXT,
          end_time TEXT,
          duration TEXT,
          description TEXT,
          teacher TEXT,
          objectives TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student TEXT,
          question TEXT,
          category TEXT,
          status TEXT DEFAULT 'pending',
          response TEXT,
          submitted_at TEXT,
          closed_at TEXT,
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS issues (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          severity TEXT DEFAULT 'warning',
          title TEXT,
          description TEXT,
          related_item_id INTEGER,
          related_item_type TEXT,
          status TEXT DEFAULT 'open',
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_type TEXT NOT NULL,
          item_id INTEGER NOT NULL,
          reviewer TEXT,
          comment TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_subtitles_time ON subtitles(start_time, end_time)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)`);

      resolve();
    });
  });
}

function getDB() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDB()');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function closeDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDB,
  getDB,
  run,
  get,
  all,
  closeDB,
  DB_PATH
};
