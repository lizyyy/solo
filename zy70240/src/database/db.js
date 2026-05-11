const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'port-cargo.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dangerous_goods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cargo_code TEXT UNIQUE NOT NULL,
      cargo_name TEXT NOT NULL,
      hazard_class TEXT NOT NULL,
      un_number TEXT,
      flash_point REAL,
      toxicity_level TEXT,
      packaging_type TEXT,
      quantity REAL,
      unit TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      batch_id TEXT,
      is_duplicate INTEGER DEFAULT 0,
      correction_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS storage_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hazard_class TEXT NOT NULL,
      storage_zone TEXT NOT NULL,
      min_isolation_distance REAL NOT NULL,
      incompatible_classes TEXT,
      special_requirements TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS isolation_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cargo_code TEXT NOT NULL,
      check_id TEXT UNIQUE NOT NULL,
      storage_zone TEXT,
      assigned_position TEXT,
      distance_to_nearby REAL,
      is_violation INTEGER DEFAULT 0,
      violation_type TEXT,
      risk_level TEXT,
      check_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      batch_id TEXT,
      FOREIGN KEY (cargo_code) REFERENCES dangerous_goods(cargo_code)
    );

    CREATE TABLE IF NOT EXISTS operation_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id TEXT UNIQUE NOT NULL,
      cargo_code TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      scheduled_time TIMESTAMP,
      actual_time TIMESTAMP,
      status TEXT DEFAULT 'draft',
      approved_by TEXT,
      rejection_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      batch_id TEXT,
      FOREIGN KEY (cargo_code) REFERENCES dangerous_goods(cargo_code)
    );

    CREATE TABLE IF NOT EXISTS batch_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT UNIQUE NOT NULL,
      total_items INTEGER DEFAULT 0,
      processed_items INTEGER DEFAULT 0,
      violation_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'processing',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS export_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      export_id TEXT UNIQUE NOT NULL,
      batch_id TEXT,
      export_type TEXT,
      record_count INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dg_code ON dangerous_goods(cargo_code);
    CREATE INDEX IF NOT EXISTS idx_dg_batch ON dangerous_goods(batch_id);
    CREATE INDEX IF NOT EXISTS idx_iso_batch ON isolation_checks(batch_id);
    CREATE INDEX IF NOT EXISTS idx_plan_batch ON operation_plans(batch_id);
    CREATE INDEX IF NOT EXISTS idx_plan_status ON operation_plans(status);
  `);

  const rulesCount = db.prepare('SELECT COUNT(*) as count FROM storage_rules').get();
  if (rulesCount.count === 0) {
    const rules = [
      { hazard_class: '1.1', storage_zone: 'A1-EXPLOSIVE', min_isolation_distance: 50.0, incompatible_classes: '1.2,1.3,2.1,3,4.1', special_requirements: '防爆区' },
      { hazard_class: '1.2', storage_zone: 'A2-EXPLOSIVE', min_isolation_distance: 30.0, incompatible_classes: '1.1,1.3,2.1,3', special_requirements: '防爆区' },
      { hazard_class: '1.3', storage_zone: 'A3-EXPLOSIVE', min_isolation_distance: 20.0, incompatible_classes: '1.1,1.2,2.1', special_requirements: '防爆区' },
      { hazard_class: '2.1', storage_zone: 'B1-FLAMMABLE_GAS', min_isolation_distance: 25.0, incompatible_classes: '1.1,1.2,1.3,3,4.1,5.1', special_requirements: '通风良好' },
      { hazard_class: '2.2', storage_zone: 'B2-NON_FLAMMABLE_GAS', min_isolation_distance: 10.0, incompatible_classes: '2.1,3', special_requirements: '' },
      { hazard_class: '2.3', storage_zone: 'B3-TOXIC_GAS', min_isolation_distance: 35.0, incompatible_classes: '2.1,3,4.1,6.1', special_requirements: '防毒区' },
      { hazard_class: '3', storage_zone: 'C-FLAMMABLE_LIQUID', min_isolation_distance: 20.0, incompatible_classes: '1.1,1.2,2.1,4.1,4.2,4.3,5.1,5.2,8', special_requirements: '防火区' },
      { hazard_class: '4.1', storage_zone: 'D1-FLAMMABLE_SOLID', min_isolation_distance: 15.0, incompatible_classes: '1.1,1.2,2.1,3,5.1,5.2,8', special_requirements: '' },
      { hazard_class: '4.2', storage_zone: 'D2-SPONTANEOUS', min_isolation_distance: 20.0, incompatible_classes: '3,5.1,5.2,8', special_requirements: '低温存储' },
      { hazard_class: '4.3', storage_zone: 'D3-DANGEROUS_WHEN_WET', min_isolation_distance: 25.0, incompatible_classes: '3,5.1,5.2,8', special_requirements: '防水区' },
      { hazard_class: '5.1', storage_zone: 'E1-OXIDIZING', min_isolation_distance: 20.0, incompatible_classes: '1.1,1.2,2.1,3,4.1,4.2,4.3,6.1,8', special_requirements: '' },
      { hazard_class: '5.2', storage_zone: 'E2-ORGANIC_PEROXIDE', min_isolation_distance: 30.0, incompatible_classes: '1.1,1.2,2.1,3,4.1,4.2,4.3,6.1,8', special_requirements: '低温存储' },
      { hazard_class: '6.1', storage_zone: 'F1-TOXIC', min_isolation_distance: 25.0, incompatible_classes: '1.1,2.3,3,5.1,5.2,8', special_requirements: '防毒区' },
      { hazard_class: '6.2', storage_zone: 'F2-INFECTIOUS', min_isolation_distance: 40.0, incompatible_classes: '1.1,1.2,2.3,3,5.1,5.2,6.1,8', special_requirements: '隔离区' },
      { hazard_class: '7', storage_zone: 'G-RADIOACTIVE', min_isolation_distance: 50.0, incompatible_classes: '所有类别', special_requirements: '辐射防护' },
      { hazard_class: '8', storage_zone: 'H-CORROSIVE', min_isolation_distance: 20.0, incompatible_classes: '3,4.1,4.2,4.3,5.1,5.2,6.1,6.2', special_requirements: '防腐区' },
      { hazard_class: '9', storage_zone: 'I-MISCELLANEOUS', min_isolation_distance: 10.0, incompatible_classes: '', special_requirements: '' }
    ];

    const insertRule = db.prepare(`
      INSERT INTO storage_rules (hazard_class, storage_zone, min_isolation_distance, incompatible_classes, special_requirements)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items) => {
      for (const rule of items) {
        insertRule.run(rule.hazard_class, rule.storage_zone, rule.min_isolation_distance, rule.incompatible_classes, rule.special_requirements);
      }
    });
    transaction(rules);
  }
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  getDb
};
