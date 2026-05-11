const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
let SQL = null;
const dbPath = path.join(__dirname, '..', 'data', 'aftersales.db');

function formatDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

function getNow() {
  return formatDate(new Date());
}

function toBoolean(val) {
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return val ? 1 : 0;
  return val ? 1 : 0;
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

async function initDatabase() {
  SQL = await initSqlJs();

  let existingData = null;
  if (fs.existsSync(dbPath)) {
    try {
      existingData = fs.readFileSync(dbPath);
      console.log('从文件加载现有数据库');
    } catch (e) {
      console.warn('读取现有数据库失败，将创建新数据库');
    }
  }

  if (existingData) {
    db = new SQL.Database(existingData);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS warranties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_sn TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      warranty_expire_date TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_code TEXT UNIQUE NOT NULL,
      part_name TEXT NOT NULL,
      category TEXT NOT NULL,
      requires_recycling INTEGER DEFAULT 0,
      recycling_days INTEGER DEFAULT 14,
      unit TEXT DEFAULT '件',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 0,
      locked_quantity INTEGER DEFAULT 0,
      warehouse TEXT DEFAULT 'main',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS part_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_no TEXT UNIQUE NOT NULL,
      warranty_id INTEGER,
      product_sn TEXT NOT NULL,
      part_id INTEGER NOT NULL,
      part_code TEXT NOT NULL,
      part_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      reason TEXT NOT NULL,
      fault_type TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address TEXT NOT NULL,
      shipping_city TEXT,
      is_in_warranty INTEGER DEFAULT 0,
      requires_recycling INTEGER DEFAULT 0,
      recycling_deadline TEXT,
      status TEXT DEFAULT 'pending_review',
      review_comment TEXT,
      reject_reason TEXT,
      logistics_company TEXT,
      tracking_no TEXT,
      shipping_address_modified INTEGER DEFAULT 0,
      original_shipping_address TEXT,
      old_part_logistics_company TEXT,
      old_part_tracking_no TEXT,
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      operator TEXT,
      remark TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS overdue_todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      todo_type TEXT NOT NULL,
      todo_description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      is_handled INTEGER DEFAULT 0,
      handled_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT DEFAULT 'locked',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  saveDatabase();
}

function exec(sql, params = []) {
  try {
    db.run(sql, params);
    const changes = db.getRowsModified();
    saveDatabase();
    return { changes };
  } catch (e) {
    console.error('SQL执行错误:', sql, e.message);
    throw e;
  }
}

function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push(row);
    }
    stmt.free();
    return rows;
  } catch (e) {
    console.error('SQL查询错误:', sql, e.message);
    throw e;
  }
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const result = queryOne('SELECT last_insert_rowid() as id');
  const changes = db.getRowsModified();
  return { lastInsertRowid: result ? result.id : 0, changes };
}

function seedData() {
  console.log('开始初始化测试数据...');
  
  const existingParts = query('SELECT * FROM parts LIMIT 1');
  console.log('现有配件数量:', existingParts ? existingParts.length : 0);
  
  if (!existingParts || existingParts.length === 0) {
    console.log('初始化配件数据...');
    const parts = [
      { part_code: 'PWR-001', part_name: '电源线', category: '配件', requires_recycling: 0, recycling_days: 0 },
      { part_code: 'REM-001', part_name: '遥控器', category: '配件', requires_recycling: 1, recycling_days: 14 },
      { part_code: 'BAT-001', part_name: '电池组', category: '配件', requires_recycling: 1, recycling_days: 14 },
      { part_code: 'FIL-001', part_name: '过滤网', category: '配件', requires_recycling: 0, recycling_days: 0 },
      { part_code: 'BRK-001', part_name: '小支架', category: '小配件', requires_recycling: 0, recycling_days: 0 },
    ];

    const quantities = [50, 30, 0, 100, 200];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const result = runInsert(
        'INSERT INTO parts (part_code, part_name, category, requires_recycling, recycling_days, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [part.part_code, part.part_name, part.category, toBoolean(part.requires_recycling), part.recycling_days, getNow()]
      );
      console.log(`插入配件: ${part.part_code}, ID: ${result.lastInsertRowid}`);
      
      runInsert(
        'INSERT INTO inventory (part_id, quantity, locked_quantity, warehouse, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?)',
        [result.lastInsertRowid, quantities[i], 'main', getNow(), getNow()]
      );
      console.log(`插入库存: part_id=${result.lastInsertRowid}, quantity=${quantities[i]}`);
    }
    console.log('配件数据初始化完成');
  }

  const existingWarranties = query('SELECT * FROM warranties LIMIT 1');
  console.log('现有保修数量:', existingWarranties ? existingWarranties.length : 0);
  
  if (!existingWarranties || existingWarranties.length === 0) {
    console.log('初始化保修数据...');
    const today = new Date();
    const expireInWarranty = new Date(today);
    expireInWarranty.setMonth(expireInWarranty.getMonth() + 6);

    const expiredDate = new Date(today);
    expiredDate.setMonth(expiredDate.getMonth() - 1);

    runInsert(
      'INSERT INTO warranties (product_sn, product_name, customer_name, customer_phone, purchase_date, warranty_expire_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['SN2024001', '智能空调X1', '张三', '13800138001', '2023-06-01', expireInWarranty.toISOString().split('T')[0], 'active', getNow(), getNow()]
    );
    runInsert(
      'INSERT INTO warranties (product_sn, product_name, customer_name, customer_phone, purchase_date, warranty_expire_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['SN2023001', '智能空调X1', '李四', '13800138002', '2022-01-01', expiredDate.toISOString().split('T')[0], 'active', getNow(), getNow()]
    );
    runInsert(
      'INSERT INTO warranties (product_sn, product_name, customer_name, customer_phone, purchase_date, warranty_expire_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['SN2024002', '智能电视T2', '王五', '13800138003', '2023-09-15', expireInWarranty.toISOString().split('T')[0], 'active', getNow(), getNow()]
    );
    console.log('保修数据初始化完成');
  }

  const partsAfter = query('SELECT * FROM parts');
  const inventoryAfter = query('SELECT * FROM inventory');
  console.log(`初始化后: parts=${partsAfter.length}, inventory=${inventoryAfter.length}`);

  saveDatabase();
  console.log('数据库已保存');
}

function transaction(fn) {
  db.run('BEGIN TRANSACTION');
  try {
    fn();
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

module.exports = {
  initDatabase,
  seedData,
  exec,
  query,
  queryOne,
  runInsert,
  transaction,
  getNow,
  formatDate,
  toBoolean,
  saveDatabase
};
