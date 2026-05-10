const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'quality.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS return_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform_order_no TEXT UNIQUE NOT NULL,
          product_name TEXT NOT NULL,
          product_sku TEXT NOT NULL,
          return_reason TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending',
          disposition TEXT,
          disposed_at DATETIME,
          notes TEXT
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS quality_checks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_order_id INTEGER NOT NULL,
          appearance TEXT,
          appearance_notes TEXT,
          accessories TEXT,
          accessories_notes TEXT,
          packaging TEXT,
          packaging_notes TEXT,
          function_test TEXT,
          function_test_notes TEXT,
          overall_result TEXT,
          inspector TEXT,
          checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (return_order_id) REFERENCES return_orders(id) ON DELETE CASCADE
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          product_name TEXT NOT NULL,
          good_quantity INTEGER DEFAULT 0,
          repair_quantity INTEGER DEFAULT 0,
          scrap_quantity INTEGER DEFAULT 0,
          total_quantity INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          return_order_id INTEGER,
          sku TEXT NOT NULL,
          change_type TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          quantity INTEGER DEFAULT 1,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (return_order_id) REFERENCES return_orders(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function createSampleData() {
  const count = await get('SELECT COUNT(*) as c FROM return_orders');
  if (count.c > 0) return;
  
  const samples = [
    { no: 'TM202605010001', name: '无线蓝牙耳机 Pro', sku: 'EAR-BT-PRO-001', reason: '7天无理由', customer: '张三', phone: '13800138001' },
    { no: 'JD202605020002', name: '智能手表 S3', sku: 'WATCH-S3-001', reason: '功能异常', customer: '李四', phone: '13800138002' },
    { no: 'PDD202605030003', name: '充电宝 20000mAh', sku: 'POWER-20K-001', reason: '包装破损', customer: '王五', phone: '13800138003' },
    { no: 'TM202605040004', name: 'USB-C 数据线', sku: 'CABLE-C-001', reason: '质量问题', customer: '赵六', phone: '13800138004' },
  ];
  
  const stmt = db.prepare(`
    INSERT INTO return_orders (platform_order_no, product_name, product_sku, return_reason, customer_name, customer_phone)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const s of samples) {
    await new Promise((resolve, reject) => {
      stmt.run(s.no, s.name, s.sku, s.reason, s.customer, s.phone, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  
  stmt.finalize();
  console.log('已创建样例数据');
}

module.exports = {
  initDB,
  run,
  get,
  all,
  createSampleData,
  db
};
