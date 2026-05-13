const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'rental.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lenses (
      id TEXT PRIMARY KEY,
      lens_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specs TEXT,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS light_stands (
      id TEXT PRIMARY KEY,
      stand_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      specs TEXT,
      status TEXT DEFAULT 'available',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      lens_id TEXT NOT NULL,
      light_stand_ids TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      deposit_amount REAL DEFAULT 0,
      deposit_status TEXT DEFAULT 'pending',
      deposit_transaction_id TEXT,
      status TEXT DEFAULT 'pending',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lens_id) REFERENCES lenses(id)
    );

    CREATE TABLE IF NOT EXISTS rental_timeline (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS inspection_records (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      inspector TEXT NOT NULL,
      lens_condition TEXT,
      light_stand_conditions TEXT,
      issues_found TEXT,
      photos TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS repair_quotes (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      estimated_cost REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS modification_history (
      id TEXT PRIMARY KEY,
      rental_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      modified_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (rental_id) REFERENCES rentals(id)
    );

    CREATE TABLE IF NOT EXISTS processed_callbacks (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      rental_id TEXT NOT NULL,
      amount REAL,
      processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedData() {
  const lensCount = db.prepare('SELECT COUNT(*) as count FROM lenses').get().count;
  if (lensCount === 0) {
    const lenses = [
      { id: 'lens1', lens_code: 'LENS-001', name: '佳能 EF 24-70mm f/2.8L II', specs: '标准变焦镜头', status: 'available' },
      { id: 'lens2', lens_code: 'LENS-002', name: '尼康 AF-S 70-200mm f/2.8E', specs: '长焦变焦镜头', status: 'available' },
      { id: 'lens3', lens_code: 'LENS-003', name: '索尼 FE 85mm f/1.4 GM', specs: '定焦人像镜头', status: 'available' },
    ];

    const insertLens = db.prepare('INSERT INTO lenses (id, lens_code, name, specs, status) VALUES (?, ?, ?, ?, ?)');
    lenses.forEach(l => insertLens.run(l.id, l.lens_code, l.name, l.specs, l.status));

    const lightStands = [
      { id: 'ls1', stand_code: 'STAND-001', name: '曼富图 MT055CXPRO3', specs: '碳纤维三脚架', status: 'available' },
      { id: 'ls2', stand_code: 'STAND-002', name: '金贝 JB-2600FP', specs: '气垫灯架', status: 'available' },
      { id: 'ls3', stand_code: 'STAND-003', name: '神牛 SL-60W', specs: 'LED补光灯', status: 'available' },
    ];

    const insertStand = db.prepare('INSERT INTO light_stands (id, stand_code, name, specs, status) VALUES (?, ?, ?, ?, ?)');
    lightStands.forEach(s => insertStand.run(s.id, s.stand_code, s.name, s.specs, s.status));
  }
}

initDatabase();
seedData();

module.exports = db;
