const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  createTables();
  saveDatabase();
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS bus_routes (
      id TEXT PRIMARY KEY,
      route_number TEXT NOT NULL,
      vehicle_number TEXT NOT NULL,
      driver_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(route_number, vehicle_number)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS storage_points (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      address TEXT,
      contact_phone TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS lost_items (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      description TEXT,
      item_category TEXT,
      photos TEXT,
      status TEXT NOT NULL DEFAULT 'REGISTERED',
      driver_id TEXT,
      driver_name TEXT,
      route_number TEXT,
      vehicle_number TEXT,
      bus_route_id TEXT,
      current_storage_point_id TEXT,
      found_time TEXT NOT NULL,
      registered_at TEXT DEFAULT (datetime('now')),
      estimated_value REAL,
      owner_name TEXT,
      owner_phone TEXT,
      special_marks TEXT,
      FOREIGN KEY (bus_route_id) REFERENCES bus_routes(id),
      FOREIGN KEY (current_storage_point_id) REFERENCES storage_points(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS storage_transfers (
      id TEXT PRIMARY KEY,
      lost_item_id TEXT NOT NULL,
      from_storage_point_id TEXT,
      to_storage_point_id TEXT NOT NULL,
      transfer_time TEXT DEFAULT (datetime('now')),
      transferred_by TEXT,
      reason TEXT,
      notes TEXT,
      FOREIGN KEY (lost_item_id) REFERENCES lost_items(id),
      FOREIGN KEY (from_storage_point_id) REFERENCES storage_points(id),
      FOREIGN KEY (to_storage_point_id) REFERENCES storage_points(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      lost_item_id TEXT NOT NULL,
      claimant_name TEXT NOT NULL,
      claimant_phone TEXT NOT NULL,
      claimant_id_number TEXT,
      claim_description TEXT,
      proof_photos TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      submitted_at TEXT DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT,
      pickup_time TEXT,
      pickup_verified INTEGER DEFAULT 0,
      FOREIGN KEY (lost_item_id) REFERENCES lost_items(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS overdue_processing (
      id TEXT PRIMARY KEY,
      lost_item_id TEXT NOT NULL,
      overdue_days INTEGER NOT NULL,
      processing_type TEXT NOT NULL,
      processing_time TEXT DEFAULT (datetime('now')),
      processed_by TEXT,
      notes TEXT,
      FOREIGN KEY (lost_item_id) REFERENCES lost_items(id)
    );
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      performed_by TEXT,
      performed_at TEXT DEFAULT (datetime('now'))
    );
  `);
  
  initializeRules();
  initializeStoragePoints();
}

function initializeRules() {
  const defaultRules = [
    { id: 'rule_001', name: 'overdue_notice_days', value: '15', description: '失物逾期多少天后开始处理' },
    { id: 'rule_002', name: 'overdue_donation_days', value: '90', description: '失物逾期多少天后捐赠' },
    { id: 'rule_003', name: 'claim_review_timeout_hours', value: '72', description: '认领申请审核超时时间（小时）' },
    { id: 'rule_004', name: 'min_claim_evidence_required', value: '2', description: '认领所需最小证据数量' },
    { id: 'rule_005', name: 'storage_transfer_auto_approval', value: 'false', description: '保管流转是否自动审批' },
  ];
  
  for (const rule of defaultRules) {
    const existing = db.exec('SELECT id FROM rules WHERE id = ?', [rule.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      db.run(
        'INSERT INTO rules (id, name, value, description) VALUES (?, ?, ?, ?)',
        [rule.id, rule.name, rule.value, rule.description]
      );
    }
  }
}

function initializeStoragePoints() {
  const defaultPoints = [
    { id: 'storage_001', name: '公交总站失物招领处', address: '市中心公交总站1号窗口', contact_phone: '400-123-4567' },
    { id: 'storage_002', name: '东区中转站', address: '东区公交枢纽B栋', contact_phone: '400-123-4568' },
    { id: 'storage_003', name: '西区中转站', address: '西区客运站2楼', contact_phone: '400-123-4569' },
  ];
  
  for (const point of defaultPoints) {
    const existing = db.exec('SELECT id FROM storage_points WHERE id = ?', [point.id]);
    if (existing.length === 0 || existing[0].values.length === 0) {
      db.run(
        'INSERT INTO storage_points (id, name, address, contact_phone) VALUES (?, ?, ?, ?)',
        [point.id, point.name, point.address, point.contact_phone]
      );
    }
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

function getDb() {
  return db;
}

module.exports = {
  initDatabase,
  getDb,
  saveDatabase
};
