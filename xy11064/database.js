const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'deposit.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deposit_no TEXT UNIQUE NOT NULL,
      student_name TEXT NOT NULL,
      student_phone TEXT NOT NULL,
      instrument_type TEXT NOT NULL,
      instrument_brand TEXT NOT NULL,
      instrument_model TEXT NOT NULL,
      instrument_serial TEXT NOT NULL,
      deposit_amount REAL NOT NULL,
      rental_start_date TEXT NOT NULL,
      expected_return_date TEXT,
      actual_return_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      store TEXT NOT NULL,
      manager TEXT NOT NULL,
      string_condition TEXT,
      body_condition TEXT,
      damage_description TEXT,
      damage_type TEXT,
      deduction_amount REAL DEFAULT 0,
      refund_amount REAL,
      evidence_photos TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_status ON deposits(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_store ON deposits(store)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_manager ON deposits(manager)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_rental_start_date ON deposits(rental_start_date)`);
});

module.exports = db;
