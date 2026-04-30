const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'equipment.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS equipment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      borrower TEXT NOT NULL,
      borrow_date TEXT NOT NULL,
      expected_return_date TEXT NOT NULL,
      actual_return_date TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'borrowed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_equipment ON borrow_records(equipment_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_status ON borrow_records(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_borrow_records_expected_return ON borrow_records(expected_return_date)`);
});

module.exports = db;
