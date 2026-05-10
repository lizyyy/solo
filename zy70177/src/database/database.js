const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'milestone_service.db');
const db = new sqlite3.Database(dbPath);

const initDatabase = () => {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        client TEXT NOT NULL,
        amount REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        acceptance_status TEXT DEFAULT 'pending',
        invoice_status TEXT DEFAULT 'pending',
        collected_amount REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS acceptances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        milestone_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        confirmed_by TEXT,
        confirmed_at TEXT,
        rejection_reason TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (milestone_id) REFERENCES milestones(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        milestone_id INTEGER NOT NULL,
        invoice_no TEXT UNIQUE NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        issued_date TEXT,
        approved_by TEXT,
        approved_at TEXT,
        issued_by TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (milestone_id) REFERENCES milestones(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        payment_date TEXT NOT NULL,
        bank_reference TEXT,
        payer TEXT,
        remarks TEXT,
        status TEXT DEFAULT 'received',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS payment_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        invoice_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        assigned_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
};

function runAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  initDatabase,
  runAsync,
  getAsync,
  allAsync
};
