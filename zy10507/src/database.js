const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.TEST_DB || path.join(dataDir, 'tickets.db');
const db = new sqlite3.Database(dbPath);

function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
          ticket_number TEXT PRIMARY KEY,
          priority TEXT NOT NULL CHECK(priority IN ('P1', 'P2', 'P3', 'P4')),
          current_node TEXT NOT NULL,
          deadline DATETIME NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'ESCALATED', 'RESOLVED', 'EXCEPTION')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          conclusion TEXT,
          raw_input TEXT,
          processing_notes TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS ticket_nodes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_number TEXT NOT NULL,
          node_name TEXT NOT NULL,
          assignee TEXT NOT NULL,
          entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          left_at DATETIME,
          sla_deadline DATETIME NOT NULL,
          status TEXT DEFAULT 'ACTIVE',
          FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_number TEXT NOT NULL,
          node_name TEXT NOT NULL,
          reminder_type TEXT NOT NULL,
          sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sent_to TEXT NOT NULL,
          deduplication_key TEXT UNIQUE NOT NULL,
          FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS escalations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_number TEXT NOT NULL,
          from_node TEXT NOT NULL,
          to_node TEXT NOT NULL,
          escalated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT NOT NULL,
          escalated_to TEXT NOT NULL,
          FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS manual_corrections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_number TEXT NOT NULL,
          corrected_by TEXT NOT NULL,
          correction_type TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT,
          corrected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reason TEXT,
          FOREIGN KEY (ticket_number) REFERENCES tickets(ticket_number)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getOne(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initDatabase,
  runQuery,
  getOne,
  getAll,
  db
};
