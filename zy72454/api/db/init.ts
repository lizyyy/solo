import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const initTables = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS breakpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_inspection',
      has_construction_detour INTEGER NOT NULL DEFAULT 0,
      redline_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bus_card_times (
      id TEXT PRIMARY KEY,
      breakpoint_id TEXT NOT NULL,
      import_batch_id TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      passenger_count INTEGER NOT NULL,
      source_date TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      FOREIGN KEY (breakpoint_id) REFERENCES breakpoints(id),
      FOREIGN KEY (import_batch_id) REFERENCES import_batches(id),
      UNIQUE(breakpoint_id, time_slot, source_date)
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      total_records INTEGER NOT NULL,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      imported_by TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS history_records (
      id TEXT PRIMARY KEY,
      breakpoint_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      change_type TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      FOREIGN KEY (breakpoint_id) REFERENCES breakpoints(id)
    );

    CREATE TABLE IF NOT EXISTS boundary_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      trigger_condition TEXT NOT NULL,
      judgment_logic TEXT NOT NULL,
      modification_method TEXT NOT NULL,
      rollback_method TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_breakpoints_status ON breakpoints(status);
    CREATE INDEX IF NOT EXISTS idx_breakpoints_detour ON breakpoints(has_construction_detour);
    CREATE INDEX IF NOT EXISTS idx_bus_card_times_breakpoint ON bus_card_times(breakpoint_id);
    CREATE INDEX IF NOT EXISTS idx_history_breakpoint ON history_records(breakpoint_id);
  `);
};

const seedBoundaryRules = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM boundary_rules').get() as { cnt: number };
  if (count.cnt > 0) return;

  const rules = [
    {
      id: 'rule-001',
      name: '施工临时改道未同步地图',
      description: '发现施工临时改道但地图数据未同步更新的情况',
      trigger_condition: '巡检员标记 has_construction_detour = true 且状态非 pending_review',
      judgment_logic: '自动将状态流转为 pending_review，不归为正常，保留给居民代表复核',
      modification_method: '设置 status = pending_review，记录操作人和时间戳，生成历史快照',
      rollback_method: '从历史快照恢复 status，清除施工改道标记，记录回滚操作',
    },
    {
      id: 'rule-002',
      name: '重复导入公交刷卡时段',
      description: '同一断点同一时段同一日期的刷卡数据重复导入',
      trigger_condition: 'UNIQUE(breakpoint_id, time_slot, source_date) 约束冲突',
      judgment_logic: '识别为重复数据，跳过不导入，不计入数量统计',
      modification_method: '不执行插入，累计 duplicate_count，导入完成后报告重复数量',
      rollback_method: '删除导入批次关联的所有 bus_card_times，恢复断点状态',
    },
    {
      id: 'rule-003',
      name: '仅修改备注的历史追踪',
      description: '巡检员仅修改红线图备注，不改变断点状态',
      trigger_condition: 'PATCH /breakpoints/:id 仅包含 redline_note 字段变更',
      judgment_logic: '记录为 update 类型变更，保存修改前后的备注内容',
      modification_method: '更新 redline_note，生成 history_record，oldValue/newValue 分别记录备注原文和新文',
      rollback_method: '从 history_record 取 oldValue 恢复到 redline_note，生成新的回滚历史记录',
    },
  ];

  const stmt = db.prepare(`
    INSERT INTO boundary_rules 
    (id, name, description, trigger_condition, judgment_logic, modification_method, rollback_method, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const rule of rules) {
    stmt.run(
      rule.id,
      rule.name,
      rule.description,
      rule.trigger_condition,
      rule.judgment_logic,
      rule.modification_method,
      rule.rollback_method
    );
  }
};

const seedMockData = () => {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM breakpoints').get() as { cnt: number };
  if (count.cnt > 0) return;

  const now = new Date().toISOString();
  const breakpoints = [
    {
      id: 'bp-001',
      name: '绿道北段断点A',
      location: '中山路与和平大道交叉口',
      lat: 30.5928,
      lng: 114.3055,
      status: 'pending_inspection' as const,
      has_construction_detour: 0,
      redline_note: null,
    },
    {
      id: 'bp-002',
      name: '绿道中段断点B',
      location: '解放公园东门南侧',
      lat: 30.6012,
      lng: 114.2987,
      status: 'inspecting' as const,
      has_construction_detour: 1,
      redline_note: '地铁施工临时占用，预计3个月后恢复',
    },
    {
      id: 'bp-003',
      name: '绿道南段断点C',
      location: '东湖路省博对面',
      lat: 30.5589,
      lng: 114.3612,
      status: 'pending_review' as const,
      has_construction_detour: 1,
      redline_note: '管线施工，改道方案需居民代表确认',
    },
    {
      id: 'bp-004',
      name: '绿道东段断点D',
      location: '珞瑜路光谷广场',
      lat: 30.5082,
      lng: 114.4021,
      status: 'confirmed' as const,
      has_construction_detour: 0,
      redline_note: '已完成路面修复，验收通过',
    },
  ];

  const bpStmt = db.prepare(`
    INSERT INTO breakpoints (id, name, location, lat, lng, status, has_construction_detour, redline_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const bp of breakpoints) {
    bpStmt.run(bp.id, bp.name, bp.location, bp.lat, bp.lng, bp.status, bp.has_construction_detour, bp.redline_note, now, now);
  }

  const historyStmt = db.prepare(`
    INSERT INTO history_records (id, breakpoint_id, field_name, old_value, new_value, changed_by, changed_at, change_type, snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  historyStmt.run(
    'hist-001',
    'bp-003',
    'has_construction_detour',
    '0',
    '1',
    '市政巡检员-小付',
    now,
    'update',
    JSON.stringify({ before: { has_construction_detour: false }, after: { has_construction_detour: true } })
  );

  historyStmt.run(
    'hist-002',
    'bp-003',
    'redline_note',
    null,
    '管线施工，改道方案需居民代表确认',
    '市政巡检员-小付',
    now,
    'update',
    JSON.stringify({ before: { redline_note: null }, after: { redline_note: '管线施工，改道方案需居民代表确认' } })
  );
};

export const initDb = () => {
  initTables();
  seedBoundaryRules();
  seedMockData();
};

export default db;
