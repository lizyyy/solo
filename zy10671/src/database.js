const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'scheduling.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS channels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          priority INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS topics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          cover_image TEXT,
          content_type TEXT NOT NULL,
          created_by TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS schedules (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic_id INTEGER NOT NULL,
          channel_id INTEGER NOT NULL,
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          operator TEXT NOT NULL,
          remark TEXT,
          conflict_info TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (topic_id) REFERENCES topics(id),
          FOREIGN KEY (channel_id) REFERENCES channels(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS schedule_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schedule_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          old_status TEXT,
          new_status TEXT,
          operator TEXT NOT NULL,
          remark TEXT,
          change_details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_schedules_channel_time ON schedules(channel_id, start_time, end_time)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_schedule_history_schedule ON schedule_history(schedule_id)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

module.exports = { db, initDatabase, closeDatabase, run, get, all };
