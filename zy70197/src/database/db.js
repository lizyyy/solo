const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'framework_agreements.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      reserved_amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, year)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      agreement_id TEXT NOT NULL,
      reserved_amount REAL NOT NULL DEFAULT 0,
      used_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES agreements(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agreement_id TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      released_at DATETIME,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (agreement_id) REFERENCES agreements(id)
    );

    CREATE TABLE IF NOT EXISTS amount_records (
      id TEXT PRIMARY KEY,
      agreement_id TEXT NOT NULL,
      project_id TEXT,
      order_id TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agreement_id) REFERENCES agreements(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_project ON orders(project_id);
    CREATE INDEX IF NOT EXISTS idx_amount_records_agreement ON amount_records(agreement_id);
    CREATE INDEX IF NOT EXISTS idx_amount_records_project ON amount_records(project_id);
  `);
}

module.exports = {
  db,
  initDatabase
};
