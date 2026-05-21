const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, '../../data');
const dbPath = path.join(dbDir, 'medicine-inventory.db');

function ensureDataDir() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('创建数据目录:', dbDir);
  }
}

function isDatabaseInitialized(db) {
  return new Promise((resolve) => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='medicines'", (err, row) => {
      resolve(!!row);
    });
  });
}

function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`PRAGMA foreign_keys = ON`);

      db.run(`CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        specification TEXT,
        manufacturer TEXT,
        unit TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        system_code TEXT UNIQUE NOT NULL,
        sync_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS inventory_batches (
        id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        batch_no TEXT NOT NULL,
        production_date DATE,
        expiry_date DATE NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        occupied_quantity INTEGER NOT NULL DEFAULT 0,
        source_id TEXT NOT NULL,
        warehouse_location TEXT,
        status TEXT DEFAULT 'normal',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (medicine_id) REFERENCES medicines(id),
        FOREIGN KEY (source_id) REFERENCES inventory_sources(id),
        UNIQUE(medicine_id, batch_no, source_id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS occupancy_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        order_no TEXT,
        department TEXT,
        operator TEXT,
        reason TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        released_at DATETIME,
        FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS expiry_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        warning_days INTEGER NOT NULL,
        critical_days INTEGER NOT NULL,
        is_default BOOLEAN DEFAULT 0,
        medicine_categories TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS delivery_receipts (
        id TEXT PRIMARY KEY,
        delivery_no TEXT UNIQUE NOT NULL,
        source_id TEXT NOT NULL,
        total_quantity INTEGER NOT NULL,
        received_quantity INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        delivery_time DATETIME,
        receive_time DATETIME,
        operator TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES inventory_sources(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS delivery_items (
        id TEXT PRIMARY KEY,
        receipt_id TEXT NOT NULL,
        medicine_id TEXT NOT NULL,
        batch_no TEXT NOT NULL,
        planned_quantity INTEGER NOT NULL,
        actual_quantity INTEGER,
        expiry_date DATE,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (receipt_id) REFERENCES delivery_receipts(id),
        FOREIGN KEY (medicine_id) REFERENCES medicines(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS discrepancy_orders (
        id TEXT PRIMARY KEY,
        order_no TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        source_id TEXT,
        medicine_id TEXT,
        batch_no TEXT,
        expected_quantity INTEGER NOT NULL,
        actual_quantity INTEGER NOT NULL,
        difference INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolver TEXT,
        resolution TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES inventory_sources(id),
        FOREIGN KEY (medicine_id) REFERENCES medicines(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS sync_logs (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        error_message TEXT,
        request_id TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (source_id) REFERENCES inventory_sources(id)
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        operation_type TEXT NOT NULL,
        table_name TEXT,
        record_id TEXT,
        before_data TEXT,
        after_data TEXT,
        operator TEXT,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function seedData(db) {
  return new Promise((resolve, reject) => {
    const { v4: uuidv4 } = require('uuid');
    
    db.serialize(() => {
      const medicines = [
        { id: uuidv4(), code: 'MED001', name: '阿莫西林胶囊', specification: '0.25g*24粒', manufacturer: '华北制药', unit: '盒' },
        { id: uuidv4(), code: 'MED002', name: '布洛芬缓释胶囊', specification: '0.3g*20粒', manufacturer: '中美史克', unit: '盒' },
        { id: uuidv4(), code: 'MED003', name: '维生素C片', specification: '100mg*100片', manufacturer: '东北制药', unit: '瓶' },
        { id: uuidv4(), code: 'MED004', name: '盐酸二甲双胍片', specification: '0.5g*30片', manufacturer: '中美上海施贵宝', unit: '盒' },
        { id: uuidv4(), code: 'MED005', name: '硝苯地平控释片', specification: '30mg*7片', manufacturer: '拜耳医药', unit: '盒' }
      ];

      const stmt1 = db.prepare('INSERT OR IGNORE INTO medicines (id, code, name, specification, manufacturer, unit) VALUES (?, ?, ?, ?, ?, ?)');
      medicines.forEach(med => stmt1.run(med.id, med.code, med.name, med.specification, med.manufacturer, med.unit));
      stmt1.finalize();

      const sources = [
        { id: uuidv4(), name: 'HIS系统', type: 'his', system_code: 'HIS001', sync_url: 'http://his.example.com/api', is_active: 1 },
        { id: uuidv4(), name: '仓库系统', type: 'warehouse', system_code: 'WH001', sync_url: 'http://warehouse.example.com/api', is_active: 1 },
        { id: uuidv4(), name: '配送系统', type: 'delivery', system_code: 'DEL001', sync_url: 'http://delivery.example.com/api', is_active: 1 }
      ];

      const stmt2 = db.prepare('INSERT OR IGNORE INTO inventory_sources (id, name, type, system_code, sync_url, is_active) VALUES (?, ?, ?, ?, ?, ?)');
      sources.forEach(src => stmt2.run(src.id, src.name, src.type, src.system_code, src.sync_url, src.is_active));
      stmt2.finalize();

      const today = new Date();
      const batches = [
        { id: uuidv4(), medicine_id: medicines[0].id, batch_no: '20240101', expiry_date: new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()).toISOString().split('T')[0], quantity: 100, source_id: sources[0].id, status: 'normal' },
        { id: uuidv4(), medicine_id: medicines[1].id, batch_no: '20240201', expiry_date: new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()).toISOString().split('T')[0], quantity: 50, source_id: sources[1].id, status: 'normal' },
        { id: uuidv4(), medicine_id: medicines[2].id, batch_no: '20240301', expiry_date: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()).toISOString().split('T')[0], quantity: 200, source_id: sources[0].id, status: 'normal' },
        { id: uuidv4(), medicine_id: medicines[0].id, batch_no: '20240115', expiry_date: new Date(today.getFullYear(), today.getMonth() + 10, today.getDate()).toISOString().split('T')[0], quantity: 80, source_id: sources[1].id, status: 'normal' }
      ];

      const stmt3 = db.prepare('INSERT OR IGNORE INTO inventory_batches (id, medicine_id, batch_no, expiry_date, quantity, occupied_quantity, source_id, status) VALUES (?, ?, ?, ?, ?, 0, ?, ?)');
      batches.forEach(b => stmt3.run(b.id, b.medicine_id, b.batch_no, b.expiry_date, b.quantity, b.source_id, b.status));
      stmt3.finalize();

      const occupancies = [
        { id: uuidv4(), batch_id: batches[0].id, quantity: 20, order_no: 'ORD001', department: '门诊药房', operator: '张药师', reason: '门诊发药', status: 'active' },
        { id: uuidv4(), batch_id: batches[0].id, quantity: 30, order_no: 'ORD002', department: '住院药房', operator: '李药师', reason: '住院摆药', status: 'active' },
        { id: uuidv4(), batch_id: batches[1].id, quantity: 10, order_no: 'ORD003', department: '急诊药房', operator: '王药师', reason: '急诊发药', status: 'active' }
      ];

      const stmt4 = db.prepare('INSERT OR IGNORE INTO occupancy_records (id, batch_id, quantity, order_no, department, operator, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      occupancies.forEach(o => stmt4.run(o.id, o.batch_id, o.quantity, o.order_no, o.department, o.operator, o.reason, o.status));
      stmt4.finalize();

      db.run('UPDATE inventory_batches SET occupied_quantity = (SELECT SUM(quantity) FROM occupancy_records WHERE occupancy_records.batch_id = inventory_batches.id AND occupancy_records.status = ?) WHERE id IN (SELECT batch_id FROM occupancy_records WHERE status = ?)', ['active', 'active'], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function initDatabase() {
  ensureDataDir();

  const db = new sqlite3.Database(dbPath);

  try {
    const initialized = await isDatabaseInitialized(db);
    
    if (!initialized) {
      console.log('检测到新数据库，开始初始化...');
      await createTables(db);
      console.log('数据库表创建完成');
      await seedData(db);
      console.log('测试数据导入完成');
    } else {
      console.log('数据库已存在，跳过初始化');
    }
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    throw err;
  } finally {
    db.close();
  }
}

module.exports = { initDatabase, dbPath };
