const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'customer_success.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      csm_id TEXT,
      csm_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      contract_no TEXT UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      month TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      UNIQUE(customer_id, month)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      title TEXT,
      severity TEXT CHECK(severity IN ('low', 'medium', 'high', 'critical')),
      status TEXT CHECK(status IN ('open', 'in_progress', 'closed')),
      satisfaction_score REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS renewal_opportunities (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      amount REAL NOT NULL,
      stage TEXT CHECK(stage IN ('identified', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost')) DEFAULT 'identified',
      probability REAL DEFAULT 0.2,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (contract_id) REFERENCES contracts(id),
      UNIQUE(customer_id, contract_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS follow_up_records (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      csm_id TEXT,
      type TEXT,
      content TEXT,
      next_follow_up_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_exemptions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      reason TEXT,
      exempted_by TEXT,
      exempted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      next_review_date TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS health_scores (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      score REAL NOT NULL,
      risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      risk_reasons TEXT,
      calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
});

module.exports = db;
