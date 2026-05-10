const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'supplier.db');
let db;

async function init() {
  const fs = require('fs');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  await createTables();
  await seedRules();
}

async function createTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      contact TEXT,
      phone TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS qualifications (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      certificate_no TEXT,
      effective_date TEXT,
      expiry_date TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS expiry_rules (
      id TEXT PRIMARY KEY,
      qualification_type TEXT NOT NULL,
      warning_days INTEGER DEFAULT 30,
      freeze_days INTEGER DEFAULT 0,
      auto_trigger_supplement INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      order_no TEXT NOT NULL,
      amount REAL,
      item_list TEXT,
      status TEXT DEFAULT 'pending',
      freeze_reason TEXT,
      approved_by TEXT,
      rejected_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS supplement_requests (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      qualification_id TEXT NOT NULL,
      reason TEXT,
      new_certificate_no TEXT,
      new_expiry_date TEXT,
      submitted_by TEXT,
      submitted_at TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      rejected_by TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (qualification_id) REFERENCES qualifications(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS recovery_requests (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      rejected_by TEXT,
      rejected_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS risk_list (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS exception_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      supplier_id TEXT,
      qualification_id TEXT,
      order_id TEXT,
      endpoint TEXT,
      method TEXT,
      error TEXT,
      raw_data TEXT,
      status TEXT DEFAULT 'pending',
      handled_at TEXT,
      handled_by TEXT,
      handling_notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS freeze_logs (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      qualification_id TEXT,
      risk_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );
  `);
}

async function seedRules() {
  const count = await db.get('SELECT COUNT(*) as count FROM expiry_rules');
  if (count.count === 0) {
    const rules = [
      { id: 'rule_business_license', qualification_type: '营业执照', warning_days: 90, freeze_days: 0, auto_trigger_supplement: 1 },
      { id: 'rule_food_license', qualification_type: '食品经营许可证', warning_days: 60, freeze_days: 0, auto_trigger_supplement: 1 },
      { id: 'rule_product_cert', qualification_type: '产品认证', warning_days: 30, freeze_days: 7, auto_trigger_supplement: 1 },
      { id: 'rule_other', qualification_type: '其他资质', warning_days: 30, freeze_days: 0, auto_trigger_supplement: 0 }
    ];
    
    const insert = await db.prepare(`
      INSERT INTO expiry_rules (id, qualification_type, warning_days, freeze_days, auto_trigger_supplement, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    
    for (const rule of rules) {
      await insert.run(rule.id, rule.qualification_type, rule.warning_days, rule.freeze_days, rule.auto_trigger_supplement);
    }
    await insert.finalize();
  }
}

function getDb() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 init()');
  }
  return db;
}

module.exports = { init, getDb };
