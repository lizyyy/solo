const fs = require('fs');
const path = require('path');
const db = require('../utils/db-helper');
const { closeDB } = require('../config/database');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

async function initDB() {
  console.log('开始初始化数据库...');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS strains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS isolation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      level TEXT NOT NULL,
      description TEXT,
      can_coexist_with TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS cages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      room TEXT NOT NULL,
      rack TEXT NOT NULL,
      position TEXT NOT NULL,
      max_capacity INTEGER DEFAULT 5,
      current_occupancy INTEGER DEFAULT 0,
      strain_id INTEGER,
      gender TEXT,
      isolation_rule_id INTEGER,
      status TEXT DEFAULT 'available',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (strain_id) REFERENCES strains(id),
      FOREIGN KEY (isolation_rule_id) REFERENCES isolation_rules(id)
    );

    CREATE TABLE IF NOT EXISTS animals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      animal_id TEXT NOT NULL UNIQUE,
      strain_id INTEGER NOT NULL,
      gender TEXT NOT NULL,
      birth_date TEXT,
      weight REAL,
      isolation_rule_id INTEGER,
      health_status TEXT DEFAULT 'normal',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (strain_id) REFERENCES strains(id),
      FOREIGN KEY (isolation_rule_id) REFERENCES isolation_rules(id)
    );

    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL UNIQUE,
      animal_id INTEGER NOT NULL,
      cage_id INTEGER,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      previous_cage_id INTEGER,
      source_allocation_id INTEGER,
      validation_rules TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (animal_id) REFERENCES animals(id),
      FOREIGN KEY (cage_id) REFERENCES cages(id),
      FOREIGN KEY (previous_cage_id) REFERENCES cages(id),
      FOREIGN KEY (source_allocation_id) REFERENCES allocations(id)
    );

    CREATE TABLE IF NOT EXISTS allocation_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      allocation_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      operator TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (allocation_id) REFERENCES allocations(id)
    );

    CREATE INDEX IF NOT EXISTS idx_allocations_request_id ON allocations(request_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_animal_id ON allocations(animal_id);
    CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
    CREATE INDEX IF NOT EXISTS idx_cages_status ON cages(status);
    CREATE INDEX IF NOT EXISTS idx_animals_strain ON animals(strain_id);
  `);

  console.log('数据库初始化完成！');
  closeDB();
}

initDB().catch(err => {
  console.error('数据库初始化失败:', err);
  closeDB();
});
