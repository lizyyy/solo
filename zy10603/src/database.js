const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/tickets.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('数据库连接成功');
    initTables();
  }
});

function initTables() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      bot_tag TEXT NOT NULL,
      human_queue TEXT NOT NULL,
      customer_emotion TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AUTO_PROCESS',
      conflict_count INTEGER DEFAULT 0,
      last_conflict_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ticket_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      action TEXT NOT NULL,
      operator TEXT DEFAULT 'system',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS import_validation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      row_number INTEGER NOT NULL,
      session_id TEXT,
      is_valid BOOLEAN NOT NULL,
      errors TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_session_id ON tickets(session_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_history_ticket_id ON ticket_history(ticket_id)`);
  });
}

module.exports = db;
