const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'qc.db');
const DATA_DIR = path.join(__dirname, 'data');

let db = null;

async function initDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    createTables();
    saveDatabase();
  }
  
  console.log('数据库初始化完成');
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      box_type TEXT,
      box_size TEXT,
      customer_name TEXT,
      quantity INTEGER,
      production_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cardboard_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_number TEXT NOT NULL UNIQUE,
      corrugated_type TEXT,
      paper_grade TEXT,
      manufacturer TEXT,
      production_date TEXT,
      expiration_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS test_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      batch_number TEXT,
      edge_crush REAL,
      edge_crush_min REAL,
      burst_strength REAL,
      burst_strength_min REAL,
      test_date TEXT,
      tester TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS warehouse_environment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_date TEXT NOT NULL,
      temperature REAL,
      humidity REAL,
      location TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loading_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      vehicle_number TEXT,
      loading_date TEXT,
      stack_layers INTEGER,
      total_weight REAL,
      destination TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      assessment_date TEXT DEFAULT CURRENT_TIMESTAMP,
      pressure_risk TEXT DEFAULT 'low',
      pressure_risk_reason TEXT,
      moisture_risk TEXT DEFAULT 'low',
      moisture_risk_reason TEXT,
      stack_risk TEXT DEFAULT 'low',
      stack_risk_reason TEXT,
      overall_risk TEXT DEFAULT 'low',
      manual_override TEXT,
      override_reason TEXT,
      override_by TEXT,
      override_date TEXT,
      review_status TEXT DEFAULT 'pending',
      notes TEXT,
      UNIQUE(order_number, assessment_date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS review_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL,
      note_type TEXT,
      content TEXT,
      reviewer TEXT,
      review_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('数据库表创建完成');
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDatabase() {
  return db;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return { success: true, lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0].values[0][0] };
  } catch (error) {
    console.error('SQL 执行错误:', error);
    return { success: false, error: error.message };
  }
}

function get(sql, params = []) {
  try {
    const result = db.exec(sql, params);
    if (result.length > 0 && result[0].values.length > 0) {
      const columns = result[0].columns;
      const row = result[0].values[0];
      const obj = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }
    return null;
  } catch (error) {
    console.error('SQL 查询错误:', error);
    return null;
  }
}

function all(sql, params = []) {
  try {
    const result = db.exec(sql, params);
    if (result.length > 0) {
      const columns = result[0].columns;
      return result[0].values.map(row => {
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      });
    }
    return [];
  } catch (error) {
    console.error('SQL 查询错误:', error);
    return [];
  }
}

function exec(sql) {
  try {
    db.run(sql);
    saveDatabase();
    return { success: true };
  } catch (error) {
    console.error('SQL 执行错误:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  run,
  get,
  all,
  exec
};
