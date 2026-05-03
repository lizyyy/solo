const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../../data/fire-extinguisher.db');
const DB_DIR = path.join(__dirname, '../../data');

// 确保数据目录存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// 全局数据库实例
let db = null;

/**
 * 初始化数据库连接
 */
async function init() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('数据库连接成功');
        // 启用外键约束
        db.run('PRAGMA foreign_keys = ON');
        // 创建数据表
        createTables().then(resolve).catch(reject);
      }
    });
  });
}

/**
 * 创建所有数据表
 */
async function createTables() {
  const tableQueries = [
    // 器材台账表
    `CREATE TABLE IF NOT EXISTS equipment (
      id TEXT PRIMARY KEY,
      equipment_code TEXT UNIQUE NOT NULL,
      batch_number TEXT NOT NULL,
      equipment_type TEXT NOT NULL,
      model TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      production_date TEXT,
      purchase_date TEXT,
      expiration_date TEXT,
      location TEXT,
      status TEXT DEFAULT 'normal',
      is_scrapped INTEGER DEFAULT 0,
      scrapped_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 巡检记录表
    `CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      equipment_id TEXT NOT NULL,
      inspection_date TEXT NOT NULL,
      inspector TEXT,
      status TEXT NOT NULL,
      pressure_status TEXT,
      hose_status TEXT,
      nozzle_status TEXT,
      safety_pin_status TEXT,
      appearance_status TEXT,
      weight_status TEXT,
      maintenance_suggestion TEXT,
      next_inspection_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipment (id)
    )`,
    
    // 厂家召回清单表
    `CREATE TABLE IF NOT EXISTS recalls (
      id TEXT PRIMARY KEY,
      recall_code TEXT UNIQUE NOT NULL,
      manufacturer TEXT NOT NULL,
      recall_reason TEXT NOT NULL,
      recall_date TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      affected_batches TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 召回匹配表
    `CREATE TABLE IF NOT EXISTS recall_matches (
      id TEXT PRIMARY KEY,
      recall_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      match_date TEXT DEFAULT CURRENT_TIMESTAMP,
      is_notified INTEGER DEFAULT 0,
      notified_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recall_id) REFERENCES recalls (id),
      FOREIGN KEY (equipment_id) REFERENCES equipment (id),
      UNIQUE(recall_id, equipment_id)
    )`,
    
    // 派工单表
    `CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      recall_match_id TEXT NOT NULL,
      order_code TEXT UNIQUE NOT NULL,
      assigned_to TEXT,
      assigned_date TEXT,
      deadline_date TEXT NOT NULL,
      status TEXT DEFAULT 'created',
      actual_completion_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recall_match_id) REFERENCES recall_matches (id)
    )`,
    
    // 状态流转记录表
    `CREATE TABLE IF NOT EXISTS status_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      change_reason TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 逾期风险记录表
    `CREATE TABLE IF NOT EXISTS overdue_risks (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      deadline_date TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      days_overdue INTEGER DEFAULT 0,
      is_resolved INTEGER DEFAULT 0,
      resolved_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(entity_type, entity_id)
    )`
  ];

  // 逐个执行创建表的SQL
  for (const query of tableQueries) {
    await runQuery(query);
  }

  console.log('所有数据表创建成功');
}

/**
 * 执行SQL查询（无返回结果）
 */
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('SQL执行失败:', sql, err.message);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

/**
 * 执行SQL查询（返回单条结果）
 */
function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('SQL查询失败:', sql, err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * 执行SQL查询（返回多条结果）
 */
function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('SQL查询失败:', sql, err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 批量插入数据
 */
async function batchInsert(table, columns, values) {
  if (values.length === 0) return;
  
  const placeholders = `(${columns.map(() => '?').join(', ')})`;
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;
  
  const stmt = db.prepare(sql);
  for (const value of values) {
    stmt.run(value);
  }
  
  return new Promise((resolve, reject) => {
    stmt.finalize((err) => {
      if (err) {
        console.error('批量插入失败:', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 关闭数据库连接
 */
function close() {
  if (db) {
    db.close((err) => {
      if (err) {
        console.error('数据库关闭失败:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
    });
  }
}

module.exports = {
  init,
  runQuery,
  getQuery,
  allQuery,
  batchInsert,
  close
};
