const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'camp.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS camps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          max_retry_sign INTEGER DEFAULT 3,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS enrollments (
          id TEXT PRIMARY KEY,
          camp_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          student_name TEXT NOT NULL,
          remaining_retry_sign INTEGER DEFAULT 3,
          streak_days INTEGER DEFAULT 0,
          locked_reward INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (camp_id) REFERENCES camps(id),
          UNIQUE(camp_id, student_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS daily_signs (
          id TEXT PRIMARY KEY,
          camp_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          sign_date TEXT NOT NULL,
          status TEXT DEFAULT 'pending_review',
          homework_url TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (camp_id) REFERENCES camps(id),
          FOREIGN KEY (student_id) REFERENCES enrollments(student_id),
          UNIQUE(camp_id, student_id, sign_date)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS retry_signs (
          id TEXT PRIMARY KEY,
          camp_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          retry_date TEXT NOT NULL,
          status TEXT DEFAULT 'pending_review',
          homework_url TEXT,
          reviewed_at TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (camp_id) REFERENCES camps(id),
          FOREIGN KEY (student_id) REFERENCES enrollments(student_id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rewards (
          id TEXT PRIMARY KEY,
          camp_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          reward_name TEXT NOT NULL,
          reward_type TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (camp_id) REFERENCES camps(id),
          FOREIGN KEY (student_id) REFERENCES enrollments(student_id)
        )
      `);

      db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_camp ON enrollments(camp_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_signs_camp_student ON daily_signs(camp_id, student_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_retries_camp_student ON retry_signs(camp_id, student_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_signs_date ON daily_signs(sign_date)`);
    });
    resolve();
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

module.exports = {
  initDatabase,
  run,
  get,
  all
};
