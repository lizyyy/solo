const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'medical_center.db');
let db = null;

const initDatabase = async () => {
  const SQL = await initSqlJs();

  let dbData = null;
  if (fs.existsSync(dbPath)) {
    try {
      dbData = fs.readFileSync(dbPath);
    } catch (err) {
      console.warn('读取数据库文件失败，将创建新数据库:', err.message);
    }
  }

  db = new SQL.Database(dbData);

  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      id_card_hash TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      gender TEXT,
      birthday TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS package_items (
      id TEXT PRIMARY KEY,
      package_id TEXT NOT NULL,
      item_code TEXT NOT NULL,
      item_name TEXT NOT NULL,
      department TEXT,
      sort_order INTEGER
    );

    CREATE TABLE IF NOT EXISTS medical_records (
      id TEXT PRIMARY KEY,
      record_no TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      check_date TEXT NOT NULL,
      report_status TEXT DEFAULT 'pending',
      overall_result TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS record_items (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      result TEXT,
      abnormal_flag INTEGER DEFAULT 0,
      abnormal_desc TEXT,
      need_recheck INTEGER DEFAULT 0,
      recheck_status TEXT DEFAULT 'none',
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS print_requests (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      request_type TEXT NOT NULL,
      reason TEXT,
      operator TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS receive_records (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      request_id TEXT,
      receiver_name TEXT NOT NULL,
      receiver_id_card_hash TEXT NOT NULL,
      relation TEXT DEFAULT '本人',
      operator TEXT NOT NULL,
      receive_time DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      operator TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  saveDatabase();
  console.log('数据库表初始化完成');
};

const saveDatabase = () => {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (err) {
    console.error('保存数据库失败:', err);
  }
};

const run = (sql, params = []) => {
  if (!db) return { changes: 0 };
  try {
    const processedParams = params.map(p => p === undefined ? null : p);
    const stmt = db.prepare(sql);
    stmt.run(processedParams);
    saveDatabase();
    return { changes: db.getRowsModified() };
  } catch (err) {
    console.error('SQL run error:', err);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw err;
  }
};

const get = (sql, params = []) => {
  if (!db) return undefined;
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return result;
    }
    stmt.free();
    return undefined;
  } catch (err) {
    console.error('SQL get error:', err);
    console.error('SQL:', sql);
    console.error('Params:', params);
    return undefined;
  }
};

const all = (sql, params = []) => {
  if (!db) return [];
  try {
    const stmt = db.prepare(sql);
    if (params.length > 0) {
      stmt.bind(params);
    }
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  } catch (err) {
    console.error('SQL all error:', err);
    console.error('SQL:', sql);
    console.error('Params:', params);
    return [];
  }
};

const hashIdCard = (idCard) => {
  return require('crypto').createHash('sha256').update(idCard).digest('hex');
};

module.exports = {
  initDatabase,
  run,
  get,
  all,
  hashIdCard,
  uuidv4
};
