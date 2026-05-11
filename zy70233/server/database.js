const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
const dbPath = path.join(dbDir, 'linen.db');

let db = null;
let SQL = null;

function getDbPath() {
  return dbPath;
}

function saveDb() {
  if (db && fs.existsSync(dbDir)) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (e) {
      console.error('保存数据库失败:', e);
    }
  }
}

async function init() {
  try {
    SQL = await initSqlJs();
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbPath)) {
      try {
        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        console.log('✅ 从本地文件加载数据库');
      } catch (e) {
        console.log('⚠️ 数据库文件损坏，创建新数据库');
        db = new SQL.Database();
      }
    } else {
      db = new SQL.Database();
      console.log('✅ 创建新数据库');
    }

    createTables();
    saveDb();
    console.log('✅ 数据库初始化完成');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS linen_items (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      specification TEXT,
      initial_quality TEXT DEFAULT 'good',
      status TEXT DEFAULT 'available',
      purchase_date TEXT,
      total_washes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS stain_levels (
      id INTEGER PRIMARY KEY,
      level TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS rewash_batches (
      id INTEGER PRIMARY KEY,
      batch_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'in_progress',
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS damage_records (
      id INTEGER PRIMARY KEY,
      linen_item_id INTEGER NOT NULL,
      damage_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'reported',
      reported_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sorting_history (
      id INTEGER PRIMARY KEY,
      linen_item_id INTEGER NOT NULL,
      stain_level_id INTEGER,
      rewash_batch_id INTEGER,
      sorting_result TEXT NOT NULL,
      notes TEXT,
      sorted_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS handover_reports (
      id INTEGER PRIMARY KEY,
      report_code TEXT UNIQUE NOT NULL,
      batch_type TEXT NOT NULL,
      batch_id INTEGER,
      handover_type TEXT NOT NULL,
      items_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      handed_by TEXT,
      received_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      handover_date TEXT
    )`
  ];

  tables.forEach(sql => {
    try {
      db.run(sql);
    } catch (e) {
    }
  });
}

function processParams(params) {
  return params.map(p => p === undefined ? null : p);
}

function runQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const boundParams = processParams(params);
    stmt.run(boundParams);
    stmt.free();
    saveDb();
    return {
      lastInsertRowid: null,
      changes: db.getRowsModified()
    };
  } catch (e) {
    console.error('SQL Error:', e.message);
    console.error('SQL:', sql);
    throw e;
  }
}

function getQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  const boundParams = processParams(params);
  stmt.bind(boundParams);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function allQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  const boundParams = processParams(params);
  stmt.bind(boundParams);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function execQuery(sql) {
  const results = db.exec(sql);
  saveDb();
  return results;
}

function getDb() {
  return {
    prepare: (sql) => ({
      run: (...params) => runQuery(sql, params),
      get: (...params) => getQuery(sql, params),
      all: (...params) => allQuery(sql, params)
    }),
    exec: execQuery,
    raw: () => db
  };
}

function getNextId(table) {
  const result = getQuery(`SELECT MAX(id) as max_id FROM ${table}`);
  return (result && result.max_id ? result.max_id : 0) + 1;
}

module.exports = {
  init,
  getDb,
  getDbPath,
  getNextId,
  saveDb
};
