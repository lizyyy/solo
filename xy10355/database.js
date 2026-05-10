const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db = null;
const dbPath = path.join(__dirname, 'milk_powder.db');

function generateId() {
  return Date.now() + Math.floor(Math.random() * 10000);
}

function currentTime() {
  return new Date().toISOString();
}

function formatDate() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      brand TEXT NOT NULL,
      specification TEXT,
      quantity INTEGER NOT NULL DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      lock_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_no TEXT UNIQUE NOT NULL,
      member_id INTEGER,
      batch_no TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recalls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recall_no TEXT UNIQUE NOT NULL,
      batch_no TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS recall_affected (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recall_id INTEGER NOT NULL,
      sale_id INTEGER NOT NULL,
      member_id INTEGER,
      member_name TEXT,
      phone TEXT,
      batch_no TEXT,
      product_name TEXT,
      quantity INTEGER,
      sale_date DATETIME,
      notify_status TEXT DEFAULT 'pending',
      handle_status TEXT DEFAULT 'pending',
      handle_type TEXT,
      handle_time DATETIME,
      is_exception INTEGER DEFAULT 0,
      exception_reason TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recall_id, sale_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS handle_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recall_affected_id INTEGER NOT NULL,
      handle_type TEXT NOT NULL,
      operator TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  initSampleData();
  saveDatabase();
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function initSampleData() {
  const memberCount = db.exec('SELECT COUNT(*) as count FROM members')[0].values[0][0];
  if (memberCount === 0) {
    const now = formatDate();
    
    const members = [
      { member_no: 'M001', name: '张妈妈', phone: '13800138001', address: '北京市朝阳区', created_at: now },
      { member_no: 'M002', name: '李妈妈', phone: '13800138002', address: '北京市海淀区', created_at: now },
      { member_no: 'M003', name: '王妈妈', phone: null, address: '北京市丰台区', created_at: now },
      { member_no: 'M004', name: '赵妈妈', phone: '13800138004', address: '北京市西城区', created_at: now },
      { member_no: 'M005', name: '刘妈妈', phone: '13800138005', address: '北京市东城区', created_at: now }
    ];
    
    const memberStmt = db.prepare('INSERT INTO members (member_no, name, phone, address, created_at) VALUES (?, ?, ?, ?, ?)');
    members.forEach(m => {
      memberStmt.run([m.member_no, m.name, m.phone, m.address, m.created_at]);
    });

    const inventory = [
      { batch_no: 'B2024001', product_name: '超级能恩3段', brand: '雀巢', specification: '800g/罐', quantity: 100, is_locked: 0, created_at: now },
      { batch_no: 'B2024002', product_name: '启赋蓝钻3段', brand: '惠氏', specification: '900g/罐', quantity: 50, is_locked: 0, created_at: now },
      { batch_no: 'B2024003', product_name: '爱他美卓萃3段', brand: '爱他美', specification: '800g/罐', quantity: 200, is_locked: 0, created_at: now },
      { batch_no: 'B2024004', product_name: '飞鹤星飞帆3段', brand: '飞鹤', specification: '700g/罐', quantity: 80, is_locked: 0, created_at: now },
      { batch_no: 'B2024005', product_name: '美赞臣蓝臻3段', brand: '美赞臣', specification: '820g/罐', quantity: 60, is_locked: 0, created_at: now }
    ];
    
    const invStmt = db.prepare('INSERT INTO inventory (batch_no, product_name, brand, specification, quantity, is_locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    inventory.forEach(i => {
      invStmt.run([i.batch_no, i.product_name, i.brand, i.specification, i.quantity, i.is_locked, i.created_at]);
    });

    const sales = [
      { sale_no: 'S20240101', member_id: 1, batch_no: 'B2024001', quantity: 2, sale_date: '2024-01-15 10:30:00', created_at: now },
      { sale_no: 'S20240102', member_id: 2, batch_no: 'B2024001', quantity: 1, sale_date: '2024-01-16 14:20:00', created_at: now },
      { sale_no: 'S20240103', member_id: 3, batch_no: 'B2024001', quantity: 3, sale_date: '2024-01-17 09:15:00', created_at: now },
      { sale_no: 'S20240104', member_id: 4, batch_no: 'B2024002', quantity: 2, sale_date: '2024-01-18 16:45:00', created_at: now },
      { sale_no: 'S20240105', member_id: 5, batch_no: 'B2024001', quantity: 1, sale_date: '2024-01-19 11:00:00', created_at: now }
    ];
    
    const saleStmt = db.prepare('INSERT INTO sales (sale_no, member_id, batch_no, quantity, sale_date, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    sales.forEach(s => {
      saleStmt.run([s.sale_no, s.member_id, s.batch_no, s.quantity, s.sale_date, s.created_at]);
    });
  }
}

function queryToArray(result) {
  if (!result || result.length === 0) return [];
  
  const columns = result[0].columns;
  const values = result[0].values;
  
  return values.map(row => {
    const obj = {};
    columns.forEach((col, index) => {
      obj[col] = row[index];
    });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const result = db.exec(sql, params);
  const arr = queryToArray(result);
  return arr.length > 0 ? arr[0] : null;
}

function queryAll(sql, params = []) {
  const result = db.exec(sql, params);
  return queryToArray(result);
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  const lastId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return { lastInsertRowid: lastId };
}

function beginTransaction() {
  db.run('BEGIN TRANSACTION');
}

function commit() {
  db.run('COMMIT');
  saveDatabase();
}

function rollback() {
  db.run('ROLLBACK');
}

module.exports = {
  initDatabase,
  queryOne,
  queryAll,
  runSql,
  beginTransaction,
  commit,
  rollback,
  formatDate
};
