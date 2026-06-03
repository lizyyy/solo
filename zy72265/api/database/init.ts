import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/envelope.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const database = getDatabase();
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS envelope_records (
      id TEXT PRIMARY KEY,
      robot_arm_id TEXT NOT NULL,
      calculation_date TEXT NOT NULL,
      safety_radius_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IMPORTED',
      total_points INTEGER NOT NULL DEFAULT 0,
      mixed_points INTEGER NOT NULL DEFAULT 0,
      current_step INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by TEXT NOT NULL
    );
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_envelope_status ON envelope_records(status);
    CREATE INDEX IF NOT EXISTS idx_envelope_robot ON envelope_records(robot_arm_id);
    CREATE INDEX IF NOT EXISTS idx_envelope_date ON envelope_records(calculation_date);
  `);
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS coordinate_points (
      id TEXT PRIMARY KEY,
      envelope_id TEXT NOT NULL REFERENCES envelope_records(id),
      original_line_number INTEGER NOT NULL,
      raw_value TEXT NOT NULL,
      x_value REAL NOT NULL,
      y_value REAL NOT NULL,
      coordinate_type TEXT NOT NULL,
      is_mixed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'IMPORTED',
      safety_radius REAL,
      radius_source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_point_envelope ON coordinate_points(envelope_id);
    CREATE INDEX IF NOT EXISTS idx_point_mixed ON coordinate_points(is_mixed);
    CREATE INDEX IF NOT EXISTS idx_point_status ON coordinate_points(status);
    CREATE INDEX IF NOT EXISTS idx_point_line ON coordinate_points(original_line_number);
  `);
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      envelope_id TEXT NOT NULL REFERENCES envelope_records(id),
      point_id TEXT REFERENCES coordinate_points(id),
      action_type TEXT NOT NULL,
      original_value TEXT,
      new_value TEXT,
      operator TEXT NOT NULL,
      remark TEXT,
      timestamp TEXT NOT NULL,
      original_line_number INTEGER
    );
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_audit_envelope ON audit_logs(envelope_id);
    CREATE INDEX IF NOT EXISTS idx_audit_point ON audit_logs(point_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  `);
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS boundary_rules (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      condition TEXT NOT NULL,
      action TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      code_reference TEXT NOT NULL,
      description TEXT
    );
  `);
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS safety_radius (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      arm_model TEXT NOT NULL,
      distance REAL NOT NULL,
      radius REAL NOT NULL,
      effective_date TEXT NOT NULL
    );
  `);
  
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_radius_version ON safety_radius(version);
    CREATE INDEX IF NOT EXISTS idx_radius_arm ON safety_radius(arm_model);
  `);
  
  const ruleCount = database.prepare('SELECT COUNT(*) as count FROM boundary_rules').get() as { count: number };
  if (ruleCount.count === 0) {
    const insertRule = database.prepare(`
      INSERT INTO boundary_rules (id, rule_type, rule_name, condition, action, is_active, code_reference, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const rules = [
      ['rule_001', 'DETECTION', '经纬度格式检测', '数值在经度-180~180、纬度-90~90范围内，或包含°E/°N/W/S标记', '标记为 LAT_LNG 类型', 1, 'shared/rules/coordinateRules.ts:15-30', '检测坐标是否为经纬度格式'],
      ['rule_002', 'DETECTION', '米制格式检测', '数值带有m/米单位标记，或数值超出经纬度正常范围', '标记为 METRIC 类型', 1, 'shared/rules/coordinateRules.ts:32-48', '检测坐标是否为米制格式'],
      ['rule_003', 'DETECTION', '坐标混合检测', '同一条记录中同时检测到经纬度格式和米制格式', '标记 is_mixed=1，status=INSPECTION_REVIEW', 1, 'shared/rules/coordinateRules.ts:50-72', '检测坐标混合情况，留待巡检组复核'],
      ['rule_004', 'CORRECTION', '坐标归一化规则', '巡检组确认坐标类型后', '统一转换为米制坐标或经纬度坐标', 1, 'shared/rules/coordinateRules.ts:74-95', '经巡检组复核后进行坐标归一化'],
      ['rule_005', 'ROLLBACK', '回滚规则', '任一历史状态均可回滚', '恢复到指定历史状态，保留回滚审计记录', 1, 'shared/rules/rollbackRules.ts:10-40', '支持回滚到任一历史状态'],
      ['rule_006', 'DETECTION', '安全半径校验', '点云日志中的半径值与安全半径表差值>5%', '标记为需人工确认，radius_source=MANUAL', 1, 'shared/rules/safetyRadiusRules.ts:20-45', '校验点云日志与安全半径表的可信度'],
    ];
    
    const transaction = database.transaction(() => {
      for (const rule of rules) {
        insertRule.run(rule);
      }
    });
    transaction();
  }
  
  const radiusCount = database.prepare('SELECT COUNT(*) as count FROM safety_radius').get() as { count: number };
  if (radiusCount.count === 0) {
    const insertRadius = database.prepare(`
      INSERT INTO safety_radius (id, version, arm_model, distance, radius, effective_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const radiusData = [
      ['r001', 'V2024.01', 'ARM-001', 1.0, 1.5, '2024-01-01'],
      ['r002', 'V2024.01', 'ARM-001', 2.0, 2.0, '2024-01-01'],
      ['r003', 'V2024.01', 'ARM-001', 3.0, 2.8, '2024-01-01'],
      ['r004', 'V2024.01', 'ARM-001', 4.0, 3.5, '2024-01-01'],
      ['r005', 'V2024.01', 'ARM-001', 5.0, 4.2, '2024-01-01'],
      ['r006', 'V2024.01', 'ARM-002', 1.0, 1.2, '2024-01-01'],
      ['r007', 'V2024.01', 'ARM-002', 2.0, 1.8, '2024-01-01'],
      ['r008', 'V2024.01', 'ARM-002', 3.0, 2.5, '2024-01-01'],
      ['r009', 'V2024.02', 'ARM-001', 1.0, 1.6, '2024-02-01'],
      ['r010', 'V2024.02', 'ARM-001', 2.0, 2.1, '2024-02-01'],
      ['r011', 'V2024.02', 'ARM-001', 3.0, 2.9, '2024-02-01'],
    ];
    
    const transaction = database.transaction(() => {
      for (const data of radiusData) {
        insertRadius.run(data);
      }
    });
    transaction();
  }
}

