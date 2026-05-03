const test = require('node:test');
const assert = require('node:assert');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const parsers = require('../src/parsers');
const rules = require('../src/rules');
const stateMachine = require('../src/state-machine');
const storage = require('../src/storage');

let db;

test.before(async () => {
  db = new sqlite3.Database(':memory:');
  
  return new Promise((resolve) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS cylinders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        serial_number TEXT UNIQUE NOT NULL,
        gas_type TEXT NOT NULL,
        capacity REAL,
        manufacturer TEXT,
        manufacture_date TEXT,
        last_inspection_date TEXT,
        next_inspection_date TEXT,
        status TEXT DEFAULT 'in_stock',
        location TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inspections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cylinder_id INTEGER NOT NULL,
        inspection_date TEXT NOT NULL,
        inspector TEXT,
        result TEXT NOT NULL,
        notes TEXT,
        next_inspection_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cylinder_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        department TEXT,
        person TEXT,
        quantity INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS risk_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cylinder_id INTEGER,
        risk_type TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        reviewed_by TEXT,
        reviewed_at TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cylinder_id) REFERENCES cylinders(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        table_name TEXT,
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        user TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`, resolve);
    });
  });
});

test.after(async () => {
  return new Promise((resolve) => {
    db.close(resolve);
  });
});

test('parsers - validateCylinder should validate valid cylinder', () => {
  const cylinder = {
    serialNumber: 'TEST-001',
    gasType: '氧气',
    capacity: 40,
    manufacturer: '测试厂',
    location: '测试位置'
  };

  const result = parsers.validateCylinder(cylinder);
  assert.strictEqual(result.valid, true);
});

test('parsers - validateCylinder should reject invalid gas type', () => {
  const cylinder = {
    serialNumber: 'TEST-001',
    gasType: '无效气体',
    capacity: 40
  };

  const result = parsers.validateCylinder(cylinder);
  assert.strictEqual(result.valid, false);
});

test('parsers - validateCylinder should reject missing serial number', () => {
  const cylinder = {
    gasType: '氧气',
    capacity: 40
  };

  const result = parsers.validateCylinder(cylinder);
  assert.strictEqual(result.valid, false);
});

test('rules - checkExpiredInspection should detect expired cylinder', () => {
  const expiredCylinder = {
    id: 1,
    serial_number: 'EXP-001',
    next_inspection_date: '2024-01-01',
    status: 'in_stock'
  };

  const result = rules.checkExpiredInspection(expiredCylinder);
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.riskType, rules.RISK_TYPES.EXPIRED_INSPECTION);
});

test('rules - checkExpiredInspection should return null for valid cylinder', () => {
  const validCylinder = {
    id: 1,
    serial_number: 'VALID-001',
    next_inspection_date: '2027-01-01',
    status: 'in_stock'
  };

  const result = rules.checkExpiredInspection(validCylinder);
  assert.strictEqual(result, null);
});

test('rules - checkGasMixup should detect oxygen and laughing gas mixup', () => {
  const cylinders = [
    { id: 1, serial_number: 'OXY-001', gas_type: '氧气', status: 'in_stock', location: 'A区' },
    { id: 2, serial_number: 'LAUGH-001', gas_type: '笑气', status: 'in_stock', location: 'A区' },
    { id: 3, serial_number: 'OXY-002', gas_type: '氧气', status: 'in_stock', location: 'B区' }
  ];

  const result = rules.checkGasMixup(cylinders, 'A区');
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].riskType, rules.RISK_TYPES.GAS_MIXUP);
});

test('stateMachine - canTransition should allow valid transitions', () => {
  assert.strictEqual(stateMachine.canTransition('in_stock', 'borrowed'), true);
  assert.strictEqual(stateMachine.canTransition('borrowed', 'in_stock'), true);
  assert.strictEqual(stateMachine.canTransition('in_stock', 'scrapped'), true);
});

test('stateMachine - canTransition should reject invalid transitions', () => {
  assert.strictEqual(stateMachine.canTransition('scrapped', 'in_stock'), false);
  assert.strictEqual(stateMachine.canTransition('in_stock', 'invalid_status'), false);
});

test('storage - saveOrUpdateCylinder should create new cylinder', async () => {
  const cylinder = {
    serialNumber: 'STORAGE-TEST-001',
    gasType: '氧气',
    capacity: 40,
    location: '测试区'
  };

  const result = await storage.saveOrUpdateCylinder(db, cylinder);
  assert.strictEqual(result.action, 'created');
  assert.ok(result.id > 0);
});

test('storage - saveOrUpdateCylinder should update existing cylinder', async () => {
  const cylinder = {
    serialNumber: 'STORAGE-TEST-002',
    gasType: '氧气',
    capacity: 40,
    location: '测试区'
  };

  const createResult = await storage.saveOrUpdateCylinder(db, cylinder);
  
  cylinder.location = '更新后的位置';
  const updateResult = await storage.saveOrUpdateCylinder(db, cylinder);
  
  assert.strictEqual(updateResult.action, 'updated');
  assert.strictEqual(updateResult.id, createResult.id);
});

test('storage - getCylinderBySerialNumber should find existing cylinder', async () => {
  const cylinder = {
    serialNumber: 'FIND-TEST-001',
    gasType: '笑气',
    capacity: 40
  };

  await storage.saveOrUpdateCylinder(db, cylinder);
  const found = await storage.getCylinderBySerialNumber(db, 'FIND-TEST-001');
  
  assert.notStrictEqual(found, null);
  assert.strictEqual(found.serial_number, 'FIND-TEST-001');
  assert.strictEqual(found.gas_type, '笑气');
});

test('storage - logAudit should create audit log', async () => {
  const audit = {
    operation: 'TEST_OPERATION',
    tableName: 'cylinders',
    recordId: 1,
    newValues: JSON.stringify({ test: 'value' }),
    user: 'test_user',
    ipAddress: '127.0.0.1'
  };

  const result = await storage.logAudit(db, audit);
  assert.ok(result.id > 0);
});

test('storage - getInventoryStats should return statistics', async () => {
  const stats = await storage.getInventoryStats(db);
  assert.ok(stats.total >= 0);
  assert.ok(stats.byStatus.inStock >= 0);
  assert.ok(stats.byStatus.borrowed >= 0);
});
