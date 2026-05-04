const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'tracking.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS sterilization_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_number TEXT NOT NULL UNIQUE,
      sterilization_date TEXT NOT NULL,
      physical_monitor TEXT,
      chemical_monitor TEXT,
      biological_monitor TEXT,
      is_qualified INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS instrument_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL UNIQUE,
      package_name TEXT NOT NULL,
      cycle_number TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT DEFAULT '待放行',
      release_time TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (cycle_number) REFERENCES sterilization_cycles(cycle_number)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS distribution_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_barcode TEXT NOT NULL,
      department TEXT NOT NULL,
      receiver TEXT,
      distribution_time TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (package_barcode) REFERENCES instrument_packages(barcode)
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_package_barcode ON instrument_packages(barcode)');
  db.run('CREATE INDEX IF NOT EXISTS idx_cycle_number ON instrument_packages(cycle_number)');
  db.run('CREATE INDEX IF NOT EXISTS idx_distribution_barcode ON distribution_records(package_barcode)');
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync
};
