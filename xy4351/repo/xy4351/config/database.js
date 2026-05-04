const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(__dirname, '../data/native-plant-seed-bank.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库:', dbPath);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS volunteers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      contact TEXT,
      status TEXT NOT NULL DEFAULT '活跃',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS collection_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_code TEXT NOT NULL UNIQUE,
      site_name TEXT NOT NULL,
      location TEXT,
      latitude REAL,
      longitude REAL,
      habitat TEXT,
      elevation INTEGER,
      description TEXT,
      status TEXT NOT NULL DEFAULT '活跃',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS native_species (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      species_code TEXT NOT NULL UNIQUE,
      scientific_name TEXT NOT NULL,
      common_name TEXT,
      family TEXT,
      genus TEXT,
      species TEXT,
      native_status TEXT NOT NULL DEFAULT '乡土种',
      conservation_status TEXT,
      seed_collection_season TEXT,
      moisture_threshold REAL NOT NULL DEFAULT 8.0,
      germination_threshold REAL NOT NULL DEFAULT 50.0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cold_storages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cabinet_code TEXT NOT NULL UNIQUE,
      cabinet_name TEXT NOT NULL,
      location TEXT,
      total_slots INTEGER NOT NULL DEFAULT 10,
      temperature REAL NOT NULL DEFAULT -18.0,
      humidity REAL NOT NULL DEFAULT 30.0,
      status TEXT NOT NULL DEFAULT '正常',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS storage_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cold_storage_id INTEGER NOT NULL,
      slot_code TEXT NOT NULL UNIQUE,
      row_number INTEGER NOT NULL,
      column_number INTEGER NOT NULL,
      max_capacity INTEGER NOT NULL DEFAULT 10,
      current_usage INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT '空闲',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cold_storage_id) REFERENCES cold_storages (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS seed_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT NOT NULL UNIQUE,
      species_id INTEGER NOT NULL,
      collection_site_id INTEGER NOT NULL,
      volunteer_id INTEGER NOT NULL,
      collection_date DATE NOT NULL,
      quantity_grams INTEGER NOT NULL DEFAULT 0,
      moisture_content REAL,
      initial_germination_rate REAL,
      storage_slot_id INTEGER,
      status TEXT NOT NULL DEFAULT '待入库',
      batch_assessment TEXT NOT NULL DEFAULT '待评估',
      assessment_details TEXT,
      manual_override INTEGER DEFAULT 0,
      override_reason TEXT,
      override_by TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (species_id) REFERENCES native_species (id),
      FOREIGN KEY (collection_site_id) REFERENCES collection_sites (id),
      FOREIGN KEY (volunteer_id) REFERENCES volunteers (id),
      FOREIGN KEY (storage_slot_id) REFERENCES storage_slots (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS germination_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seed_batch_id INTEGER NOT NULL,
      test_date DATE NOT NULL,
      tested_by TEXT NOT NULL,
      seeds_planted INTEGER NOT NULL DEFAULT 0,
      seeds_germinated INTEGER NOT NULL DEFAULT 0,
      germination_rate REAL,
      test_conditions TEXT,
      duration_days INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seed_batch_id) REFERENCES seed_batches (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS seed_exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exchange_number TEXT NOT NULL UNIQUE,
      exchange_type TEXT NOT NULL,
      seed_batch_id INTEGER NOT NULL,
      quantity_grams INTEGER NOT NULL DEFAULT 0,
      requestor TEXT NOT NULL,
      request_date DATE NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT '待审核',
      approved_by TEXT,
      approval_date DATE,
      exchange_date DATE,
      assessment_before TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seed_batch_id) REFERENCES seed_batches (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER,
      exchange_id INTEGER,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT,
      assessment TEXT,
      assessment_details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES seed_batches (id),
      FOREIGN KEY (exchange_id) REFERENCES seed_exchanges (id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_seed_batches_batch_number ON seed_batches (batch_number)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_seed_batches_status ON seed_batches (status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_storage_slots_status ON storage_slots (status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_batch_id ON audit_logs (batch_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp)`);
});

module.exports = db;
