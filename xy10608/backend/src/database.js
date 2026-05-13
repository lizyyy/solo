
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 确保 data 目录存在
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'central_kitchen.db');
const db = new Database(dbPath);

// 初始化数据库表
function initDatabase() {
  db.pragma('journal_mode = WAL');
  
  // 菜单配方表
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_recipes (
      id TEXT PRIMARY KEY,
      menu_name TEXT NOT NULL,
      menu_code TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // 菜单配方明细表
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_recipe_items (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      is_optional INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (recipe_id) REFERENCES menu_recipes(id)
    );
  `);
  
  // 食材批次表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ingredient_batches (
      id TEXT PRIMARY KEY,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      batch_number TEXT UNIQUE NOT NULL,
      supplier TEXT NOT NULL,
      production_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      allergens TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // 替代料确认表
  db.exec(`
    CREATE TABLE IF NOT EXISTS substitution_confirmations (
      id TEXT PRIMARY KEY,
      original_ingredient_code TEXT NOT NULL,
      original_ingredient_name TEXT NOT NULL,
      substitute_ingredient_code TEXT NOT NULL,
      substitute_ingredient_name TEXT NOT NULL,
      recipe_id TEXT,
      menu_name TEXT,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      approved_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // 过敏原限制表
  db.exec(`
    CREATE TABLE IF NOT EXISTS allergen_restrictions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      allergen_type TEXT NOT NULL,
      restriction_level TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      expiry_date TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // 退料验收表
  db.exec(`
    CREATE TABLE IF NOT EXISTS return_acceptances (
      id TEXT PRIMARY KEY,
      return_number TEXT UNIQUE NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      returned_quantity REAL NOT NULL,
      accepted_quantity REAL,
      unit TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      inspected_by TEXT,
      inspected_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // 门店成本表
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_costs (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      menu_code TEXT,
      menu_name TEXT,
      ingredient_code TEXT NOT NULL,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      total_cost REAL NOT NULL,
      cost_type TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  // 操作日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      module_name TEXT NOT NULL,
      record_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      operator TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  
  // 修改历史记录表（保留修改前后值）
  db.exec(`
    CREATE TABLE IF NOT EXISTS change_history (
      id TEXT PRIMARY KEY,
      module_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      field_name TEXT,
      old_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );
  `);
  
  // 幂等请求表（防止重复请求导致数据翻倍）
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotent_requests (
      id TEXT PRIMARY KEY,
      request_hash TEXT UNIQUE NOT NULL,
      request_method TEXT NOT NULL,
      request_path TEXT NOT NULL,
      request_body TEXT,
      response_data TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
  
  // 复核记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_records (
      id TEXT PRIMARY KEY,
      record_type TEXT NOT NULL,
      record_id TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      review_action TEXT NOT NULL,
      review_comment TEXT,
      review_status TEXT NOT NULL,
      reviewed_at TEXT NOT NULL
    );
  `);
  
  console.log('数据库初始化完成');
}

module.exports = { db, initDatabase };
