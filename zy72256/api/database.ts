import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbDir = path.resolve(__dirname, '..', 'data')
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}

const dbPath = path.join(dbDir, 'shadow.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables()
    seedBoundaryRules()
  }
  return db
}

function initTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS coordinate_records (
      id TEXT PRIMARY KEY,
      original_line_number INTEGER NOT NULL,
      building_name TEXT NOT NULL,
      coordinate_origin_description TEXT NOT NULL,
      coordinate_type TEXT NOT NULL CHECK(coordinate_type IN ('longitude_latitude', 'metric', 'mixed')),
      raw_latitude REAL,
      raw_longitude REAL,
      raw_metric_x REAL,
      raw_metric_y REAL,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK(status IN ('pending_review', 'under_review', 'pending_inspection', 'corrected', 'confirmed')),
      retention_reason TEXT,
      inspection_photo_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES coordinate_records(id),
      operator TEXT NOT NULL,
      operator_role TEXT NOT NULL CHECK(operator_role IN ('instructor', 'inspector', 'crew')),
      action TEXT NOT NULL CHECK(action IN ('import', 'review', 'retain', 'correct', 'confirm', 'rollback', 'update_briefing')),
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      change_detail TEXT NOT NULL,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boundary_rules (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK(category IN ('detection', 'correction', 'rollback')),
      rule_name TEXT NOT NULL,
      rule_description TEXT NOT NULL,
      code_reference TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS inspection_photos (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES coordinate_records(id),
      photo_number TEXT NOT NULL,
      description TEXT,
      attached_at TEXT NOT NULL DEFAULT (datetime('now')),
      attached_by TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON coordinate_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_type ON coordinate_records(coordinate_type);
    CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_logs(record_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_photos_record ON inspection_photos(record_id);
  `)
}

function seedBoundaryRules(): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM boundary_rules').get() as { cnt: number }
  if (count.cnt > 0) return

  const insert = db.prepare(`
    INSERT INTO boundary_rules (id, category, rule_name, rule_description, code_reference, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const rules = [
    {
      id: uuidv4(),
      category: 'detection',
      rule_name: 'MIXED_COORDINATE_DETECTION',
      rule_description: '当同一记录中同时出现经纬度标识（E/W/N/S、东经/西经/北纬/南纬、度数符号°）和米制坐标标识（m/米、大数值无度符号）时，判定为混合坐标类型',
      code_reference: 'api/services/coordinateDetector.ts::detectCoordinateType',
    },
    {
      id: uuidv4(),
      category: 'detection',
      rule_name: 'DEFAULT_COORDINATE_TYPE',
      rule_description: '无法识别坐标类型时默认为米制坐标，但保留原描述供人工复核',
      code_reference: 'api/services/coordinateDetector.ts::detectCoordinateType',
    },
    {
      id: uuidv4(),
      category: 'correction',
      rule_name: 'MIXED_RETAIN_REQUIRE_REASON',
      rule_description: '混合坐标记录不可自动归为正常，必须由教官填写保留理由后才可推进状态',
      code_reference: 'api/routes/review.ts::postReview',
    },
    {
      id: uuidv4(),
      category: 'correction',
      rule_name: 'CORRECTION_MUST_LOG',
      rule_description: '任何坐标类型修正操作必须在审计日志中记录修正前后的值',
      code_reference: 'api/services/auditService.ts::createAuditLog',
    },
    {
      id: uuidv4(),
      category: 'rollback',
      rule_name: 'ROLLBACK_RESTORE_SNAPSHOT',
      rule_description: '回滚操作将记录恢复到目标审计日志的快照状态，回滚本身也记入审计日志',
      code_reference: 'api/services/auditService.ts::rollbackToSnapshot',
    },
    {
      id: uuidv4(),
      category: 'rollback',
      rule_name: 'ROLLBACK_INSPECTOR_ONLY',
      rule_description: '只有巡检组(inspector)角色可以执行回滚操作',
      code_reference: 'api/routes/audit.ts::postRollback',
    },
  ]

  const transaction = db.transaction(() => {
    for (const rule of rules) {
      insert.run(rule.id, rule.category, rule.rule_name, rule.rule_description, rule.code_reference, 1)
    }
  })
  transaction()
}
