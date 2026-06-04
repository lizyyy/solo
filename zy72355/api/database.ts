import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, '..', 'data', 'assessments.db')

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

  initializeSchema(db)
  return db
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS assessment_items (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      line_number INTEGER NOT NULL,
      raw_conclusion TEXT NOT NULL,
      direction TEXT,
      direction_normalized TEXT,
      remark TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '待补看',
      boundary_flag INTEGER NOT NULL DEFAULT 0,
      boundary_rule TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(file_hash, line_number)
    );

    CREATE TABLE IF NOT EXISTS change_records (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES assessment_items(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      reason TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_change_records_item_id ON change_records(item_id);
    CREATE INDEX IF NOT EXISTS idx_change_records_changed_at ON change_records(changed_at);
    CREATE INDEX IF NOT EXISTS idx_assessment_items_status ON assessment_items(status);

    CREATE TABLE IF NOT EXISTS boundary_rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      category TEXT NOT NULL,
      normalized_value TEXT,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
  `)

  const count = db.prepare('SELECT COUNT(*) as cnt FROM boundary_rules').get() as { cnt: number }
  if (count.cnt === 0) {
    const insert = db.prepare(`
      INSERT INTO boundary_rules (id, pattern, category, normalized_value, action, description) VALUES (?, ?, ?, ?, ?, ?)
    `)
    const batch = db.transaction(() => {
      insert.run('br001', '向左', 'direction', '负方向', 'flag_for_review', '现场师傅将负方向写成"向左"，不可自动归正常，需实验老师复核')
      insert.run('br002', '向右', 'direction', '正方向', 'flag_for_review', '现场师傅将正方向写成"向右"，需实验老师复核')
      insert.run('br003', '往上', 'direction', '上行', 'flag_for_review', '非标方向表述，需实验老师复核')
      insert.run('br004', '往下', 'direction', '下行', 'flag_for_review', '非标方向表述，需实验老师复核')
      insert.run('br005', '向前', 'direction', '前进方向', 'flag_for_review', '非标方向表述，需实验老师复核')
      insert.run('br006', '向后', 'direction', '后退方向', 'flag_for_review', '非标方向表述，需实验老师复核')
    })
    batch()
  }
}
