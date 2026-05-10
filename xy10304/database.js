const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'cleaning.db');
const dataDir = path.join(__dirname, 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class DatabaseWrapper {
  constructor(db) {
    this.db = db;
  }
  
  prepare(sql) {
    return {
      run: (...params) => {
        return new Promise((resolve, reject) => {
          this.db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
          });
        });
      },
      get: (...params) => {
        return new Promise((resolve, reject) => {
          this.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
      all: (...params) => {
        return new Promise((resolve, reject) => {
          this.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
      }
    };
  }
  
  exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  pragma(sql) {
    return new Promise((resolve, reject) => {
      this.db.run(`PRAGMA ${sql}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  serialize(callback) {
    this.db.serialize(callback);
  }
  
  transaction(callback) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.exec('BEGIN TRANSACTION');
        await callback();
        await this.exec('COMMIT');
        resolve();
      } catch (err) {
        await this.exec('ROLLBACK');
        reject(err);
      }
    });
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);
      else resolve(new DatabaseWrapper(db));
    });
  });
}

async function initDatabase() {
  const db = await openDatabase();
  
  await db.pragma('journal_mode = WAL');
  await db.pragma('foreign_keys = ON');
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      rooms INTEGER,
      area REAL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cleaners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      rating REAL DEFAULT 5.0,
      total_tasks INTEGER DEFAULT 0,
      redo_tasks INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      cleaner_id INTEGER,
      booking_id TEXT,
      guest_name TEXT,
      checkin_date TEXT,
      checkout_date TEXT,
      status TEXT DEFAULT 'assigned',
      priority TEXT DEFAULT 'normal',
      notes TEXT,
      assigned_at TEXT DEFAULT (datetime('now', 'localtime')),
      started_at TEXT,
      completed_at TEXT,
      inspected_at TEXT,
      closed_at TEXT,
      is_settled INTEGER DEFAULT 0,
      total_penalty REAL DEFAULT 0,
      total_compensation REAL DEFAULT 0,
      redo_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (cleaner_id) REFERENCES cleaners(id)
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      inspector TEXT,
      result TEXT NOT NULL,
      issues TEXT,
      penalty_points INTEGER DEFAULT 0,
      penalty_amount REAL DEFAULT 0,
      needs_redo INTEGER DEFAULT 0,
      notes TEXT,
      inspection_time TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      guest_name TEXT,
      rating INTEGER,
      issues TEXT,
      severity TEXT DEFAULT 'medium',
      needs_redo INTEGER DEFAULT 0,
      compensation_request INTEGER DEFAULT 0,
      notes TEXT,
      feedback_time TEXT DEFAULT (datetime('now', 'localtime')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS compensations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      feedback_id INTEGER,
      reason TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'approved',
      settled_from_cleaner INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (feedback_id) REFERENCES feedbacks(id)
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      changed_by TEXT,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_property ON tasks(property_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_cleaner ON tasks(cleaner_id);
    CREATE INDEX IF NOT EXISTS idx_history_task ON task_history(task_id);
  `);
  
  return db;
}

module.exports = {
  openDatabase,
  initDatabase
};
