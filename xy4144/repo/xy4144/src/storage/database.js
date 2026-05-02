const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
const DB_PATH = path.join(__dirname, '../../data/blockade.db');

/**
 * 初始化数据库
 */
async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('从现有文件加载数据库');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
  }
  
  // 创建表结构
  createTables();
  
  // 保存数据库
  saveDatabase();
  
  return db;
}

/**
 * 创建所有表结构
 */
function createTables() {
  // 线路表
  db.run(`
    CREATE TABLE IF NOT EXISTS lines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // 车站表
  db.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      is_terminal BOOLEAN DEFAULT 0,
      latitude REAL,
      longitude REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (line_id) REFERENCES lines(id)
    )
  `);
  
  // 区间表
  db.run(`
    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL,
      start_station_id TEXT NOT NULL,
      end_station_id TEXT NOT NULL,
      name TEXT NOT NULL,
      length_km REAL,
      is_up_direction BOOLEAN,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      FOREIGN KEY (start_station_id) REFERENCES stations(id),
      FOREIGN KEY (end_station_id) REFERENCES stations(id)
    )
  `);
  
  // 施工队表
  db.run(`
    CREATE TABLE IF NOT EXISTS construction_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      leader_name TEXT,
      leader_phone TEXT,
      team_size INTEGER,
      specialization TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // 接触网分区表
  db.run(`
    CREATE TABLE IF NOT EXISTS catenary_zones (
      id TEXT PRIMARY KEY,
      line_id TEXT NOT NULL,
      name TEXT NOT NULL,
      start_section_id TEXT NOT NULL,
      end_section_id TEXT NOT NULL,
      power_supply TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (line_id) REFERENCES lines(id)
    )
  `);
  
  // 行车调度命令模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS dispatch_commands (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      command_type TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // 封锁计划表（主表）
  db.run(`
    CREATE TABLE IF NOT EXISTS blockade_plans (
      id TEXT PRIMARY KEY,
      plan_number TEXT NOT NULL UNIQUE,
      line_id TEXT NOT NULL,
      work_type TEXT NOT NULL,
      work_content TEXT,
      construction_team_id TEXT,
      priority INTEGER DEFAULT 0,
      is_emergency BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'draft',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      first_train_time TEXT,
      clearance_time TEXT,
      power_off_required BOOLEAN DEFAULT 0,
      catenary_zone_ids TEXT,
      section_ids TEXT NOT NULL,
      station_ids TEXT,
      dispatch_command_id TEXT,
      applicant_id TEXT,
      applicant_name TEXT,
      approver_id TEXT,
      approver_name TEXT,
      approved_at TEXT,
      submitted_at TEXT,
      cancelled_at TEXT,
      cancelled_reason TEXT,
      conflict_check_result TEXT,
      notes TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (line_id) REFERENCES lines(id),
      FOREIGN KEY (construction_team_id) REFERENCES construction_teams(id),
      FOREIGN KEY (dispatch_command_id) REFERENCES dispatch_commands(id)
    )
  `);
  
  // 封锁计划版本历史表
  db.run(`
    CREATE TABLE IF NOT EXISTS plan_versions (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      plan_data TEXT NOT NULL,
      change_reason TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES blockade_plans(id)
    )
  `);
  
  // 冲突检查记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS conflict_checks (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      check_time TEXT DEFAULT (datetime('now')),
      check_result TEXT NOT NULL,
      conflicts TEXT,
      warnings TEXT,
      is_passed BOOLEAN,
      checked_by TEXT,
      FOREIGN KEY (plan_id) REFERENCES blockade_plans(id)
    )
  `);
  
  // 审计日志表
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      operator_id TEXT,
      operator_name TEXT,
      operation_time TEXT DEFAULT (datetime('now')),
      ip_address TEXT,
      user_agent TEXT,
      notes TEXT
    )
  `);
  
  // 资源占用表
  db.run(`
    CREATE TABLE IF NOT EXISTS resource_occupations (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES blockade_plans(id)
    )
  `);
  
  // 创建索引
  db.run('CREATE INDEX IF NOT EXISTS idx_plans_status ON blockade_plans(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_plans_line ON blockade_plans(line_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_plans_time ON blockade_plans(start_time, end_time)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(operation_time)');
  db.run('CREATE INDEX IF NOT EXISTS idx_stations_line ON stations(line_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_sections_line ON sections(line_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_resource_occupations ON resource_occupations(resource_type, resource_id, start_time)');
}

/**
 * 保存数据库到文件
 */
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

/**
 * 获取数据库实例
 */
function getDb() {
  if (!db) {
    throw new Error('数据库未初始化');
  }
  return db;
}

/**
 * 执行查询并返回结果
 */
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  
  return results;
}

/**
 * 执行 INSERT/UPDATE/DELETE 操作
 */
function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  
  return {
    changes: db.getRowsModified(),
    lastInsertRowid: db.exec('SELECT last_insert_rowid() as id')[0]?.values?.[0]?.[0]
  };
}

/**
 * 事务包装
 */
function transaction(callback) {
  db.run('BEGIN TRANSACTION');
  try {
    const result = callback();
    db.run('COMMIT');
    saveDatabase();
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}

module.exports = {
  initDatabase,
  getDb,
  query,
  run,
  transaction,
  saveDatabase
};
