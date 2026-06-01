import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '..', 'data', 'livehouse.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initTables(db)
  seedSampleData(db)
  return db
}

function initTables(d: Database.Database) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      track_name TEXT NOT NULL,
      artist TEXT NOT NULL,
      revenue REAL NOT NULL DEFAULT 0,
      share_ratio REAL,
      share_amount REAL,
      status TEXT NOT NULL CHECK(status IN ('smooth', 'needs_confirmation', 'old_standard')),
      source TEXT NOT NULL CHECK(source IN ('excel', 'audio', 'contract', 'chat_annotation')),
      original_note TEXT DEFAULT '',
      current_note TEXT DEFAULT '',
      attachments TEXT DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS judgment_logs (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      step INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('system_auto', 'manual_override', 'note_added', 'diff_detected')),
      description TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      import_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      total_files INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      failed_files TEXT DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_records_status ON records(status);
    CREATE INDEX IF NOT EXISTS idx_records_source ON records(source);
    CREATE INDEX IF NOT EXISTS idx_judgment_logs_record_id ON judgment_logs(record_id);
  `)
}

function seedSampleData(d: Database.Database) {
  const count = d.prepare('SELECT COUNT(*) as cnt FROM records').get() as { cnt: number }
  if (count.cnt > 0) return

  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

  const insertRecord = d.prepare(`
    INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertJudgment = d.prepare(`
    INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = d.transaction(() => {
    insertRecord.run('sample-001', '夏夜晚风', '回声乐队', 12000, 0.50, 6000, 'smooth', 'excel', '', '', now, now)
    insertRecord.run('sample-002', '深巷', '锈色吉他', 8000, null, null, 'needs_confirmation', 'excel', '比例未定 待核实', '比例未定 待核实', now, now)
    insertRecord.run('sample-003', '旧日之光', '老王', 5000, 0.40, 2000, 'old_standard', 'excel', '按老规矩分', '按老规矩分（旧口径比例60%，当前40%）', now, now)

    insertJudgment.run('j-001-1', 'sample-001', 1, 'system_auto', '系统匹配到合同分账比例', '分账比例50%，分账金额6000元，状态标记为顺利', now)
    insertJudgment.run('j-002-1', 'sample-002', 1, 'system_auto', '系统未找到合同分账比例', '分账比例缺失，状态标记为待确认', now)
    insertJudgment.run('j-003-1', 'sample-003', 1, 'system_auto', '来自旧Excel，检测到比例与当前标准不一致', '旧口径比例60%与当前标准50%不一致，标记为旧口径', now)
    insertJudgment.run('j-003-2', 'sample-003', 2, 'diff_detected', '补录备注后对比差异', '比例从旧口径60%调整为当前40%，差异原因：按新标准执行', now)
  })

  transaction()
}
