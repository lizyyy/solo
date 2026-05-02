const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'schedule.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      shift_type TEXT DEFAULT 'regular',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS swap_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      responder_id INTEGER,
      requester_shift_id INTEGER NOT NULL,
      responder_shift_id INTEGER,
      open_to_all INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_confirm',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      notes TEXT,
      FOREIGN KEY (requester_id) REFERENCES users(id),
      FOREIGN KEY (responder_id) REFERENCES users(id),
      FOREIGN KEY (requester_shift_id) REFERENCES shifts(id),
      FOREIGN KEY (responder_shift_id) REFERENCES shifts(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_swaps_status ON swap_requests(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_swaps_requester ON swap_requests(requester_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_swaps_responder ON swap_requests(responder_id)`);
});

module.exports = db;
