import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DB_PATH = join(__dirname, '..', 'data', 'scoring.db')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  const dir = dirname(DB_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')

  initSchema(_db)
  seedData(_db)

  return _db
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS questionnaire_raw (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      target_name TEXT NOT NULL,
      weight REAL,
      score REAL,
      denominator REAL,
      raw_value TEXT NOT NULL,
      record_type TEXT NOT NULL CHECK(record_type IN ('normal', 'zero_denominator_empty', 'supplemented')),
      source TEXT NOT NULL CHECK(source IN ('questionnaire', 'boundary_note')),
      status TEXT NOT NULL CHECK(status IN ('pending', 'review', 'confirmed', 'rejected')),
      boundary_note_id TEXT NULL,
      original_statement TEXT NULL,
      next_handler TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boundary_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      related_fields TEXT NOT NULL DEFAULT '[]',
      methodology TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      questionnaire_record_id TEXT NOT NULL REFERENCES questionnaire_raw(id),
      boundary_note_id TEXT NOT NULL REFERENCES boundary_notes(id),
      field_name TEXT NOT NULL,
      questionnaire_value TEXT NOT NULL,
      boundary_note_value TEXT NOT NULL,
      diff_description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected')),
      resolved_by TEXT,
      resolved_at TEXT,
      resolution TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operator TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('import', 'supplement', 'resolve_conflict', 'update_result', 'review')),
      target_type TEXT NOT NULL CHECK(target_type IN ('questionnaire', 'boundary_note', 'conflict', 'scoring_result')),
      target_id TEXT NOT NULL,
      before_value TEXT,
      after_value TEXT,
      reason TEXT NOT NULL,
      affected_results TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scoring_results (
      id TEXT PRIMARY KEY,
      target_name TEXT NOT NULL,
      weight REAL NOT NULL,
      score REAL NOT NULL,
      weighted_score REAL NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('questionnaire', 'boundary_note', 'manual')),
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_tasks (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES questionnaire_raw(id),
      reviewer TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
      review_note TEXT,
      original_statement TEXT NULL,
      corrected_value TEXT NULL,
      next_handler TEXT NULL,
      boundary_note_id TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_questionnaire_batch ON questionnaire_raw(batch_id);
    CREATE INDEX IF NOT EXISTS idx_questionnaire_status ON questionnaire_raw(status);
    CREATE INDEX IF NOT EXISTS idx_questionnaire_type ON questionnaire_raw(record_type);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
    CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_review_status ON review_tasks(status);
  `)

  migrateColumns(db)
}

function columnExists(db: Database.Database, tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]
  return columns.some(col => col.name === columnName)
}

function migrateColumns(db: Database.Database): void {
  const qrColumns = ['boundary_note_id', 'original_statement', 'next_handler']
  for (const col of qrColumns) {
    if (!columnExists(db, 'questionnaire_raw', col)) {
      db.prepare(`ALTER TABLE questionnaire_raw ADD COLUMN ${col} TEXT NULL`).run()
    }
  }

  const rtColumns = ['original_statement', 'corrected_value', 'next_handler', 'boundary_note_id']
  for (const col of rtColumns) {
    if (!columnExists(db, 'review_tasks', col)) {
      db.prepare(`ALTER TABLE review_tasks ADD COLUMN ${col} TEXT NULL`).run()
    }
  }
}

function seedData(db: Database.Database): void {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM questionnaire_raw').get() as { cnt: number }
  if (count.cnt > 0) return

  const now = new Date().toISOString()

  const insertQr = db.prepare(`
    INSERT INTO questionnaire_raw (id, batch_id, target_name, weight, score, denominator, raw_value, record_type, source, status, boundary_note_id, original_statement, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertQr.run('qr-001', 'batch-001', '客户满意度', 0.3, 85.0, 100.0, '客户满意度,0.3,85.0,100.0', 'normal', 'questionnaire', 'confirmed', null, null, now)
  insertQr.run('qr-002', 'batch-001', '响应时效', 0.25, 0, 0, '响应时效,0.25,,', 'zero_denominator_empty', 'questionnaire', 'review', null, null, now)
  insertQr.run('qr-003', 'batch-001', '合规达标率', 0.2, 92.0, 100.0, '合规达标率,0.2,92.0,100.0', 'supplemented', 'boundary_note', 'pending', 'bn-001', '2024年Q1之前合规达标率计算口径：分母为实际检查项数，非全部应检项数。补录时需按旧口径折算。', now)

  const insertBn = db.prepare(`
    INSERT INTO boundary_notes (id, title, content, related_fields, methodology, effective_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertBn.run('bn-001', '合规达标率旧口径说明', '2024年Q1之前合规达标率计算口径：分母为实际检查项数，非全部应检项数。补录时需按旧口径折算。', '["合规达标率"]', '旧口径：实际检查项数作分母', '2024-03-31', now, now)
  insertBn.run('bn-002', '响应时效异常处理说明', '当响应时效分母为0时（无工单），原始行可能填为空字符串，不可自动归零或归正常，需提交复核人员判断。', '["响应时效"]', '分母为0时保留空值，标记待复核', '2024-06-01', now, now)

  const insertSr = db.prepare(`
    INSERT INTO scoring_results (id, target_name, weight, score, weighted_score, source, version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  insertSr.run('sr-001', '客户满意度', 0.3, 85.0, 25.5, 'questionnaire', 1, now)
  insertSr.run('sr-002', '响应时效', 0.25, 0, 0, 'questionnaire', 1, now)
  insertSr.run('sr-003', '合规达标率', 0.2, 92.0, 18.4, 'boundary_note', 1, now)

  const insertRt = db.prepare(`
    INSERT INTO review_tasks (id, record_id, reviewer, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  insertRt.run('rt-001', 'qr-002', '复核员A', 'pending', now)
}
