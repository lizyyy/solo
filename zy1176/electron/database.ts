import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs-extra';

let db: Database.Database | null = null;

const SCHEMA_VERSION = 1;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  const dataDir = path.join(userDataPath, 'data');
  fs.ensureDirSync(dataDir);
  return path.join(dataDir, 'datamask.db');
}

export function initializeDatabase(): void {
  if (db) return;
  
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  
  if (currentVersion < SCHEMA_VERSION) {
    migrateDatabase(db, currentVersion);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}

function migrateDatabase(database: Database.Database, fromVersion: number): void {
  if (fromVersion < 1) {
    createSchemaV1(database);
  }
}

function createSchemaV1(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      mime_type TEXT,
      status TEXT DEFAULT 'pending',
      sensitive_count INTEGER DEFAULT 0,
      confirmed_count INTEGER DEFAULT 0,
      ignored_count INTEGER DEFAULT 0,
      mask_output_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS sensitive_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      pattern TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      is_builtin INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sensitive_hits (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      rule_id TEXT,
      rule_name TEXT NOT NULL,
      category TEXT NOT NULL,
      matched_text TEXT NOT NULL,
      replacement_text TEXT,
      context_before TEXT,
      context_after TEXT,
      line_number INTEGER,
      start_offset INTEGER,
      end_offset INTEGER,
      status TEXT DEFAULT 'pending',
      confidence REAL DEFAULT 1.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      FOREIGN KEY (rule_id) REFERENCES sensitive_rules(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS export_records (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      output_path TEXT NOT NULL,
      file_count INTEGER DEFAULT 0,
      mask_count INTEGER DEFAULT 0,
      manifest_path TEXT,
      risk_report_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    
    CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);
    CREATE INDEX IF NOT EXISTS idx_hits_file_id ON sensitive_hits(file_id);
    CREATE INDEX IF NOT EXISTS idx_hits_status ON sensitive_hits(status);
    CREATE INDEX IF NOT EXISTS idx_exports_project_id ON export_records(project_id);
  `);
  
  const insertRule = database.prepare(`
    INSERT INTO sensitive_rules (id, name, category, pattern, description, is_builtin, priority)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `);
  
  const builtinRules = [
    ['rule_phone_cn', '手机号(中国)', 'contact', '1[3-9]\\d{9}', '中国大陆11位手机号', 100],
    ['rule_email_general', '邮箱地址', 'contact', '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', '通用邮箱格式', 90],
    ['rule_id_cn', '身份证号(中国)', 'identity', '\\d{17}[\\dXx]', '中国大陆18位身份证号', 100],
    ['rule_name_chinese', '中文姓名', 'identity', '[\\u4e00-\\u9fa5]{2,4}', '2-4字中文姓名（需结合上下文）', 50],
    ['rule_company_name', '公司名称', 'organization', '[\\u4e00-\\u9fa5]+(?:公司|集团|科技|有限公司|股份有限公司|事务所)', '含公司后缀的企业名称', 70],
    ['rule_bank_card', '银行卡号', 'finance', '\\d{16,19}', '16-19位银行卡号', 95],
    ['rule_address_cn', '地址信息', 'location', '[\\u4e00-\\u9fa5]+(?:省|市|区|县|镇|街道|路|号|楼|单元)', '含地址后缀的地理位置', 60],
    ['rule_qq_number', 'QQ号', 'contact', '[1-9]\\d{4,10}', '5-11位QQ号码', 80],
    ['rule_wechat_id', '微信号', 'contact', '[a-zA-Z][a-zA-Z0-9_-]{5,19}', '微信号格式', 80],
    ['rule_license_plate', '车牌号', 'identity', '[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-Z][A-Z0-9]{5}[A-Z0-9挂学警港澳]?', '中国大陆车牌号', 85],
  ];
  
  for (const rule of builtinRules) {
    try {
      insertRule.run(...rule);
    } catch (e) {
      // 可能已存在，忽略
    }
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
