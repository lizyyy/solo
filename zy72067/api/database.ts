import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '..', 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'hotspot.db')
const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  warning_threshold REAL NOT NULL DEFAULT 85.0,
  critical_threshold REAL NOT NULL DEFAULT 100.0,
  coordinate_system TEXT NOT NULL DEFAULT 'chip_local',
  temperature_unit TEXT NOT NULL DEFAULT 'celsius',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hot_spot_records (
  id TEXT PRIMARY KEY,
  scheme_id TEXT NOT NULL REFERENCES schemes(id),
  name TEXT NOT NULL,
  coordinate_x REAL NOT NULL,
  coordinate_y REAL NOT NULL,
  coordinate_system TEXT NOT NULL,
  temperature REAL NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('normal', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'conflict')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_records_scheme ON hot_spot_records(scheme_id);
CREATE INDEX IF NOT EXISTS idx_records_severity ON hot_spot_records(severity);
CREATE INDEX IF NOT EXISTS idx_records_status ON hot_spot_records(status);

CREATE TABLE IF NOT EXISTS source_attachments (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES hot_spot_records(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('point_table', 'photo', 'meeting_screenshot', 'plan_note', 'manual_coordinate')),
  source_ref TEXT NOT NULL,
  source_name TEXT NOT NULL,
  description TEXT,
  imported_at TEXT NOT NULL DEFAULT (datetime('now')),
  raw_data TEXT
);
CREATE INDEX IF NOT EXISTS idx_sources_record ON source_attachments(record_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON source_attachments(source_type);

CREATE TABLE IF NOT EXISTS parameter_changes (
  id TEXT PRIMARY KEY,
  scheme_id TEXT NOT NULL REFERENCES schemes(id),
  parameter_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_changes_scheme ON parameter_changes(scheme_id);

CREATE TABLE IF NOT EXISTS source_conflicts (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES hot_spot_records(id),
  source_a_id TEXT NOT NULL REFERENCES source_attachments(id),
  source_b_id TEXT NOT NULL REFERENCES source_attachments(id),
  conflict_type TEXT NOT NULL CHECK(conflict_type IN ('coordinate_mismatch', 'value_mismatch', 'coordinate_system_mismatch')),
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
  suggestion TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_conflicts_record ON source_conflicts(record_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON source_conflicts(severity);

CREATE TABLE IF NOT EXISTS correction_snapshots (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES hot_spot_records(id),
  field_name TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by TEXT NOT NULL,
  corrected_at TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot_data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_record ON correction_snapshots(record_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_time ON correction_snapshots(corrected_at);

CREATE TABLE IF NOT EXISTS import_error_logs (
  id TEXT PRIMARY KEY,
  scheme_id TEXT NOT NULL REFERENCES schemes(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('point_table', 'photo', 'meeting_screenshot', 'plan_note', 'manual_coordinate')),
  source_ref TEXT NOT NULL,
  source_name TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK(error_type IN ('data_corrupted', 'format_invalid', 'missing_required', 'out_of_range', 'coordinate_mismatch')),
  error_message TEXT NOT NULL,
  field_detail TEXT,
  row_number INTEGER,
  photo_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fixed', 'ignored')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT,
  resolution TEXT
);
CREATE INDEX IF NOT EXISTS idx_errors_scheme ON import_error_logs(scheme_id);
CREATE INDEX IF NOT EXISTS idx_errors_type ON import_error_logs(source_type);
CREATE INDEX IF NOT EXISTS idx_errors_status ON import_error_logs(status);
`)

const existingDemo = db.prepare("SELECT id FROM schemes WHERE id = 'demo-001'").get()
if (!existingDemo) {
  const insertSample = db.transaction(() => {
    db.prepare(`
      INSERT INTO schemes (id, name, description, warning_threshold, critical_threshold, coordinate_system, temperature_unit) VALUES
      ('demo-001', '芯片封装热斑立方-样例', '许姐负责的芯片封装热斑分析样例方案，包含点位表、现场照片和周会截图多源数据', 85.0, 100.0, 'chip_local', 'celsius')
    `).run()

    db.prepare(`
      INSERT INTO import_error_logs (id, scheme_id, source_type, source_ref, source_name, error_type, error_message, field_detail, row_number, photo_number, status) VALUES
      ('err-001', 'demo-001', 'point_table', '点位表v2.3-行18', '点位表v2.3', 'data_corrupted', '点位表第18行温度值缺失小数点，解析失败', 'temperature字段', 18, NULL, 'pending'),
      ('err-002', 'demo-001', 'photo', 'PHOTO_20251114_037', '现场照片037号', 'data_corrupted', '红外照片037号元数据损坏，无法解析温度矩阵', 'EXIF温度字段', NULL, 'PHOTO_037', 'pending'),
      ('err-003', 'demo-001', 'manual_coordinate', '手改坐标-王工-20251114', '王工手改坐标', 'format_invalid', '王工手改坐标格式不符合规范，坐标值超出芯片边界', 'coordinate_x/y字段', NULL, NULL, 'fixed')
    `).run()

    db.prepare(`
      INSERT INTO hot_spot_records (id, scheme_id, name, coordinate_x, coordinate_y, coordinate_system, temperature, severity, status) VALUES
      ('hs-001', 'demo-001', 'Die中心热点-A1', 12.5, 8.3, 'chip_local', 102.4, 'critical', 'active'),
      ('hs-002', 'demo-001', '焊球区域-B3', 25.1, 15.7, 'chip_local', 89.6, 'warning', 'active'),
      ('hs-003', 'demo-001', '基板边缘-C7', 3.2, 22.8, 'substrate_global', 76.3, 'normal', 'conflict'),
      ('hs-004', 'demo-001', '焊球区域-B5', 28.9, 14.2, 'chip_local', 91.1, 'warning', 'active'),
      ('hs-005', 'demo-001', 'Die角落-D2', 2.1, 3.5, 'chip_local', 105.8, 'critical', 'active')
    `).run()

    db.prepare(`
      INSERT INTO source_attachments (id, record_id, source_type, source_ref, source_name, description, imported_at, raw_data) VALUES
      ('src-001', 'hs-001', 'point_table', '点位表v2.3-行15', '点位表v2.3', '点位表第15行记录Die中心A1区域温度102.4°C', '2025-11-15T09:30:00Z', NULL),
      ('src-002', 'hs-001', 'photo', 'PHOTO_20251114_032', '现场照片032号', '红外热像仪拍摄Die中心热点，可见明显温度集中', '2025-11-15T09:35:00Z', NULL),
      ('src-003', 'hs-001', 'meeting_screenshot', '周会20251112-截图3', '第47周周会截图3', '周会中讨论Die中心温度偏高，标注需要关注', '2025-11-15T09:40:00Z', NULL),
      ('src-004', 'hs-002', 'point_table', '点位表v2.3-行28', '点位表v2.3', '点位表第28行记录焊球B3区域温度89.6°C', '2025-11-15T09:30:00Z', NULL),
      ('src-005', 'hs-002', 'plan_note', '方案备注v1.0-第4节', '方案备注第一版', '方案备注提到B3焊球区域需持续监控', '2025-11-14T14:00:00Z', NULL),
      ('src-006', 'hs-003', 'point_table', '点位表v2.3-行42', '点位表v2.3', '点位表第42行记录基板边缘C7温度76.3°C（substrate_global坐标系）', '2025-11-15T09:30:00Z', NULL),
      ('src-007', 'hs-003', 'manual_coordinate', '手改坐标-李工-20251113', '李工手改坐标', '李工在现场手改标注C7位置，坐标系为substrate_global与chip_local不一致', '2025-11-13T16:00:00Z', NULL),
      ('src-008', 'hs-003', 'meeting_screenshot', '周会20251112-截图5', '第47周周会截图5', '周会中提到C7位置需要标注坐标系差异', '2025-11-15T09:40:00Z', NULL),
      ('src-009', 'hs-004', 'point_table', '点位表v2.3-行30', '点位表v2.3', '点位表第30行记录焊球B5区域温度91.1°C', '2025-11-15T09:30:00Z', NULL),
      ('src-010', 'hs-005', 'photo', 'PHOTO_20251114_048', '现场照片048号', '红外热像仪拍摄Die角落D2，温度集中明显', '2025-11-15T09:35:00Z', NULL),
      ('src-011', 'hs-005', 'meeting_screenshot', '周会20251112-截图7', '第47周周会截图7', '周会讨论D2角落温度异常，判断为critical', '2025-11-15T09:40:00Z', NULL),
      ('src-012', 'hs-005', 'plan_note', '方案备注v2.0-第6节', '方案备注第二版', '方案备注v2更新D2区域需重点跟踪', '2025-11-15T10:00:00Z', NULL)
    `).run()

    db.prepare(`
      INSERT INTO source_conflicts (id, record_id, source_a_id, source_b_id, conflict_type, severity, suggestion, resolved_at, resolution, resolved_by) VALUES
      ('conflict-001', 'hs-003', 'src-006', 'src-007', 'coordinate_system_mismatch', 'high', '点位表使用chip_local坐标系，李工手改坐标使用substrate_global坐标系。建议：标注两个坐标系边界，不强制合并到同一空间。可由方案经理决定采用哪个坐标系作为基准。', NULL, NULL, NULL),
      ('conflict-002', 'hs-005', 'src-011', 'src-012', 'value_mismatch', 'medium', '周会截图标注D2为warning，但方案备注v2标记为critical。建议：以最新方案备注为准，但保留周会截图作为历史参考。', NULL, NULL, NULL)
    `).run()

    db.prepare(`
      INSERT INTO parameter_changes (id, scheme_id, parameter_name, old_value, new_value, changed_by, changed_at, reason) VALUES
      ('change-001', 'demo-001', 'warning_threshold', '80.0', '85.0', '许姐', '2025-11-14T10:00:00Z', '根据周会讨论提高warning阈值至85°C'),
      ('change-002', 'demo-001', 'critical_threshold', '95.0', '100.0', '许姐', '2025-11-15T11:00:00Z', '结合现场照片数据调整critical阈值')
    `).run()
  })

  insertSample()
}

export default db
